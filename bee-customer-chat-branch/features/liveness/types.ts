/**
 * Liveness (face verification) feature types
 */

export interface CreateLivenessSessionResult {
  sessionId: string;
  directions: string[];
}

export interface SubmitLivenessImageResult {
  allPassed: boolean;
  directionPassed: boolean;
  remainingDirections: string[];
  error?: string;
}

export interface LivenessSessionStatusResult {
  sessionId: string;
  status: 'pending' | 'completed' | 'failed';
  directionsCompleted: string[];
  directionsRemaining: string[];
}

