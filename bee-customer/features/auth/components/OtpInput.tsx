import { BeeColors } from "@/constants/theme";
import { useTheme } from "@/shared/hooks/use-theme";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

/**
 * Props for the OtpInput component
 */
export interface OtpInputProps {
  /** Number of OTP digits (default: 6) */
  length?: number;
  /** Current OTP value */
  value: string;
  /** Callback when OTP value changes */
  onChangeText: (value: string) => void;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Whether to auto-focus the first input on mount */
  autoFocus?: boolean;
  /** Callback when OTP is complete (all digits filled) */
  onComplete?: (value: string) => void;
}

/**
 * OTP Input component
 * Displays multiple single-digit input fields for entering OTP codes
 * Supports auto-focus, paste, and keyboard navigation
 * 
 * @param props - OtpInput component props
 * 
 * @example
 * ```tsx
 * function OtpScreen() {
 *   const [otp, setOtp] = useState('');
 * 
 *   return (
 *     <OtpInput
 *       value={otp}
 *       onChangeText={setOtp}
 *       onComplete={(value) => {
 *         console.log('OTP complete:', value);
 *       }}
 *     />
 *   );
 * }
 * ```
 */
export function OtpInput({
  length = 6,
  value,
  onChangeText,
  disabled = false,
  autoFocus = true,
  onComplete,
}: OtpInputProps) {
  const theme = useTheme();
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(
    autoFocus ? 0 : null
  );

  /**
   * Initialize input refs array
   */
  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, length);
  }, [length]);

  /**
   * Focus on a specific input
   */
  const focusInput = useCallback((index: number) => {
    if (index >= 0 && index < length && inputRefs.current[index]) {
      inputRefs.current[index]?.focus();
      setFocusedIndex(index);
    }
  }, [length]);

  /**
   * Handle text change in an input
   */
  const handleChangeText = useCallback(
    (text: string, index: number) => {
      // Only allow digits
      const digit = text.replace(/[^0-9]/g, "");
      
      if (digit.length === 0) {
        // Clear current digit
        const newValue = value.split("");
        newValue[index] = "";
        onChangeText(newValue.join(""));
        
        // Focus previous input if available
        if (index > 0) {
          focusInput(index - 1);
        }
      } else {
        // Set current digit
        const newValue = value.split("");
        // Pad array to length if needed
        while (newValue.length < length) {
          newValue.push("");
        }
        newValue[index] = digit[digit.length - 1]; // Take last digit if multiple pasted
        const updatedValue = newValue.join("").slice(0, length);
        onChangeText(updatedValue);

        // If pasting multiple digits, fill all inputs
        if (digit.length > 1) {
          const digits = digit.slice(0, length);
          const newOtp = digits.padEnd(length, "").slice(0, length);
          onChangeText(newOtp);
          
          // Focus last filled input or last input
          const lastFilledIndex = Math.min(digits.length - 1, length - 1);
          focusInput(lastFilledIndex);
        } else {
          // Move to next input if digit entered
          if (index < length - 1) {
            focusInput(index + 1);
          } else {
            // Last input - blur
            inputRefs.current[index]?.blur();
            setFocusedIndex(null);
          }
        }

        // Check if OTP is complete
        const finalValue = digit.length > 1 
          ? digit.slice(0, length).padEnd(length, "").slice(0, length)
          : newValue.join("").slice(0, length);
        
        if (finalValue.length === length && onComplete) {
          onComplete(finalValue);
        }
      }
    },
    [value, length, onChangeText, focusInput, onComplete]
  );

  /**
   * Handle key press (backspace)
   */
  const handleKeyPress = useCallback(
    (key: string, index: number) => {
      if (key === "Backspace" && value[index] === "" && index > 0) {
        // If current input is empty and backspace pressed, focus previous
        focusInput(index - 1);
      }
    },
    [value, focusInput]
  );

  /**
   * Handle input focus
   */
  const handleFocus = useCallback((index: number) => {
    setFocusedIndex(index);
  }, []);

  /**
   * Handle input blur
   */
  const handleBlur = useCallback(() => {
    setFocusedIndex(null);
  }, []);

  /**
   * Auto-focus first input on mount
   */
  useEffect(() => {
    if (autoFocus && inputRefs.current[0] && !disabled) {
      // Small delay to ensure component is mounted
      const timer = setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [autoFocus, disabled]);

  return (
    <View style={styles.container}>
      {Array.from({ length }).map((_, index) => {
        const digit = value[index] || "";
        const isFocused = focusedIndex === index;
        const hasValue = digit.length > 0;

        return (
          <TouchableOpacity
            key={index}
            activeOpacity={1}
            onPress={() => focusInput(index)}
            style={styles.inputWrapper}
          >
            <TextInput
              ref={(ref) => {
                inputRefs.current[index] = ref;
              }}
              style={[
                styles.input,
                {
                  backgroundColor: theme.surface,
                  borderColor: isFocused
                    ? BeeColors.yellow[400]
                    : hasValue
                    ? BeeColors.green[600]
                    : theme.border,
                  color: theme.text,
                },
                isFocused && styles.inputFocused,
              ]}
              value={digit}
              onChangeText={(text) => handleChangeText(text, index)}
              onKeyPress={({ nativeEvent }) =>
                handleKeyPress(nativeEvent.key, index)
              }
              onFocus={() => handleFocus(index)}
              onBlur={handleBlur}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
              editable={!disabled}
              autoFocus={autoFocus && index === 0}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    width: "100%",
  },
  inputWrapper: {
    flex: 1,
    maxWidth: 56,
  },
  input: {
    width: "100%",
    height: 56,
    borderWidth: 2,
    borderRadius: 8,
    textAlign: "center",
    fontSize: 24,
    fontWeight: "700",
    padding: 0,
  },
  inputFocused: {
    borderWidth: 2,
  },
});

