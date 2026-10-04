import { Href, Link } from "expo-router";
import {
  openBrowserAsync,
  WebBrowserPresentationStyle,
} from "expo-web-browser";
import { type ComponentProps } from "react";

/**
 * Props for ExternalLink component
 * Extends Link props but requires href to be a string
 */
type Props = Omit<ComponentProps<typeof Link>, "href"> & {
  href: Href & string;
};

/**
 * External link component that opens URLs in an in-app browser on native platforms
 * On web, it behaves like a regular link
 * @param props - ExternalLink component props
 */
export function ExternalLink({ href, ...rest }: Props) {
  return (
    <Link
      target="_blank"
      {...rest}
      href={href}
      onPress={async (event) => {
        if (process.env.EXPO_OS !== "web") {
          // Prevent the default behavior of linking to the default browser on native.
          event.preventDefault();
          // Open the link in an in-app browser.
          await openBrowserAsync(href, {
            presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
          });
        }
      }}
    />
  );
}
