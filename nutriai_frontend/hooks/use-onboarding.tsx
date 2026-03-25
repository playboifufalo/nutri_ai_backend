import React, { createContext, useContext, useReducer } from 'react';

interface OnboardingState {
  goal: string | null;
  allergies: string[];
  dietType: string | null;
  caloricTarget: number | null;
}
interface OnboardingAction {
  type: 'SET_GOAL' | 'SET_ALLERGIES' | 'SET_DIET_TYPE' | 'SET_CALORIC_TARGET' | 'RESET';
  payload?: any;
}
const initialState: OnboardingState = {
  goal: null,
  allergies: [],
  dietType: null,
  caloricTarget: null,
};
const OnboardingContext = createContext<{
  state: OnboardingState;
  dispatch: React.Dispatch<OnboardingAction>;
} | null>(null);

function onboardingReducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case 'SET_GOAL':
      return { ...state, goal: action.payload };
    case 'SET_ALLERGIES':
      return { ...state, allergies: action.payload };
    case 'SET_DIET_TYPE':
      return { ...state, dietType: action.payload };
    case 'SET_CALORIC_TARGET':
      return { ...state, caloricTarget: action.payload };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}



export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(onboardingReducer, initialState);

  return (
    <OnboardingContext.Provider value={{ state, dispatch }}>
      {children}
    </OnboardingContext.Provider>
  );
}



export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}