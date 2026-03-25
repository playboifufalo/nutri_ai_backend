import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { advancedAuthAPI } from '@/utils/advancedAuthApi';
import { OnboardingService } from '@/utils/onboardingService';
import * as Device from 'expo-device';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

export default function LoginScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: 'nutri@example.com',
    password: 'password123',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  useEffect(() => {
    const checkAuthentication = async () => {
      try {
        const isAuth = await advancedAuthAPI.isAuthenticated();
        if (isAuth) {
          //If user is already authenticated, check onboarding
          //API communication pattern based on React data fetching practices:
          //https://react.dev/learn
          const isOnboardingCompleted = await OnboardingService.isOnboardingCompleted();
          if (isOnboardingCompleted) {
            router.replace('/(tabs)/' as any);
          } else {
            router.replace('/onboarding/goal' as any);
          }
        }
      } catch (error) {
        console.log('authentication check failed:', error);
      }
    };
    checkAuthentication();
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string): { isValid: boolean; message?: string } => {
    const validation = advancedAuthAPI.validatePassword(password);
    return {
      isValid: validation.isValid,
      message: validation.feedback.join(', ')
    };
  };

  const validateForm = () => {
    if (!formData.email || !formData.password) {
      Alert.alert('Error', 'please fill all required fields');
      return false;
    }

    if (!isLogin && !formData.username) {
      Alert.alert('Error', 'please enter username');
      return false;
    }

    if (!validateEmail(formData.email)) {
      Alert.alert('Error', 'please enter a valid email address');
      return false;
    }

    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.isValid) {
      Alert.alert('Error', passwordValidation.message || 'Invalid password');
      return false;
    }

    return true;
  };

  const handleAuth = async () => {
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const deviceId = Device.modelId || 'unknown';

      if (isLogin) {
        const result = await advancedAuthAPI.loginWithSecurity({
          email: formData.email,
          password: formData.password,
          deviceId: deviceId,
          rememberMe: rememberMe,
        });

        if (result.success) {
          // Check if onboarding needs to be shown
          const isOnboardingCompleted = await OnboardingService.isOnboardingCompleted();
          
          Alert.alert('Success!', 'You have successfully logged in', [
            {
              text: 'OK',
              onPress: () => {
                if (isOnboardingCompleted) {
                  // If onboarding is completed, go to main page
                  router.replace('/(tabs)/' as any);
                } else {
                  // If onboarding is not completed, go to preferences selection
                  router.replace('/onboarding/goal' as any);
                }
              },
            },
          ]);
        } else {
          if (result.status === 401) {
            Alert.alert('Login Failed', 'Invalid email or password. Please check your credentials and try again.');
          } else if (result.status === 423) {
            Alert.alert('Account Locked', 'Your account has been temporarily locked due to multiple failed login attempts. Please try again later or contact support.');
          } else if (result.status === 403) {
            Alert.alert('Account Inactive', 'Your account is inactive. Please contact support to reactivate your account.'); //checking all the errors
          } else if (result.status === 449) {
            Alert.alert('Two-Factor Authentication Required', 'Please enter your 2FA code to continue.');
          } else {
            Alert.alert('Login Error', result.data?.detail || 'An error occurred during login. Please try again.');
          }
        }
      } else {
        const result = await advancedAuthAPI.registerWithValidation({
          username: formData.username,
          email: formData.email,
          password: formData.password,
          acceptTerms: true, 
          marketingOptIn: false,
        });

        if (result.success) {
          Alert.alert('Success!', 'Registration completed successfully! You can now log in with your credentials.', [
            {
              text: 'OK',
              onPress: () => {
                setIsLogin(true);
                setFormData({ username: '', email: '', password: '' });
              },
            },
          ]);
        } else {
          if (result.status === 409) {
            Alert.alert('Registration Failed', 'An account with this email already exists. Please use a different email or try logging in.');
          } else if (result.status === 422) {
            Alert.alert('Invalid Data', 'Please check your input data and try again.');
          } else if (result.error) {
            Alert.alert('Registration Error', Array.isArray(result.error) ? result.error.join('\n') : result.error);
          } else {
            Alert.alert('Registration Error', result.data?.detail || 'An error occurred during registration. Please try again.');
          }
        }
      }
    } catch (error: any) {
      console.error('Authentication error:', error);
      Alert.alert('Connection Error', 'Unable to connect to server. Please check your internet connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.prompt(
      'Reset Password',
      'Enter your email address to receive password reset instructions',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async (email?: string) => {
            if (email && validateEmail(email)) {
              try {
                await advancedAuthAPI.requestPasswordReset(email);
                Alert.alert('Email Sent', 'Password reset instructions have been sent to your email address.');
              } catch (error) {
                Alert.alert('Error', 'Failed to send password reset email. Please try again.');
              }
            } else {
              Alert.alert('Error', 'Please enter a valid email address.');
            }
          },
        },
      ],
      'plain-text',
      formData.email
    );
  };

  const handleSocialLogin = (provider: string) => {
    Alert.alert('Coming Soon', `${provider} login will be available soon!`);
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/*header */}
          <View style={styles.header}>
            <IconSymbol name="leaf.fill" size={60} color="#10B981" />
            <ThemedText style={styles.title}>NutriAI</ThemedText>
            <Text style={styles.subtitle}>
              {isLogin ? 'Welcome back!' : 'Create an account'}
            </Text>
            {isLogin && (
              <Text style={styles.description}>
                Sign in to access your personalized nutrition dashboard
              </Text>
            )}
          </View>

          {/*form */}
          <View style={styles.form}>
            {!isLogin && (
              <View style={styles.inputContainer}>
                <IconSymbol name="person.fill" size={20} color="#9CA3AF" />
                <TextInput
                  style={styles.input}
                  placeholder="Username"
                  value={formData.username}
                  onChangeText={(value) => handleInputChange('username', value)}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            )}
            <View style={styles.inputContainer}>
              <IconSymbol name="envelope.fill" size={20} color="#9CA3AF" />
              <TextInput
                style={styles.input}
                placeholder="Email"
                value={formData.email}
                onChangeText={(value) => handleInputChange('email', value)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
              />
            </View>
            <View style={styles.inputContainer}>
              <IconSymbol name="lock.fill" size={20} color="#9CA3AF" />
              <TextInput
                style={styles.input}
                placeholder="Password"
                value={formData.password}
                onChangeText={(value) => handleInputChange('password', value)}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.passwordToggle}
              >
                <IconSymbol 
                  name={showPassword ? "eye.slash.fill" : "eye.fill"} 
                  size={20} 
                  color="#9CA3AF" 
                />
              </TouchableOpacity>
            </View>
            {isLogin && (
              <View style={styles.optionsRow}>
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => setRememberMe(!rememberMe)}
                >
                  <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                    {rememberMe && (
                      <IconSymbol name="checkmark" size={14} color="#FFFFFF" />
                    )}
                  </View>
                  <Text style={styles.checkboxLabel}>Remember me</Text>
                </TouchableOpacity>
                
                <TouchableOpacity onPress={handleForgotPassword}>
                  <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity
              style={[styles.authButton, isLoading && styles.buttonDisabled]}
              onPress={handleAuth}
              disabled={isLoading}
            >
              <Text style={styles.authButtonText}>
                {isLoading 
                  ? (isLogin ? 'Signing in...' : 'Signing up...') 
                  : (isLogin ? 'Sign In' : 'Sign Up')
                }
              </Text>
            </TouchableOpacity>
            {/*social Login Options */}
            {isLogin && (
              <View style={styles.socialSection}>
                <Text style={styles.orText}>Or continue with</Text>
                <View style={styles.socialButtons}>
                  <TouchableOpacity
                    style={styles.socialButton}
                    onPress={() => handleSocialLogin('Google')}
                  >
                    <IconSymbol name="globe" size={20} color="#DB4437" />
                    <Text style={styles.socialButtonText}>Google</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.socialButton}
                    onPress={() => handleSocialLogin('Apple')}
                  >
                    <IconSymbol name="apple.logo" size={20} color="#000000" />
                    <Text style={styles.socialButtonText}>Apple</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => setIsLogin(!isLogin)}
            >
              <Text style={styles.switchButtonText}>
                {isLogin 
                  ? "Don't have an account? Sign up" 
                  : 'Already have an account? Sign in'
                }
              </Text>
            </TouchableOpacity>
          </View>
          {/*demo button for testing */}
          <TouchableOpacity
            style={styles.demoButton}
            onPress={() => {
              // On skip, mark that user saw onboarding but didn't complete it
              router.replace('/(tabs)/' as any);
            }}
          >
            <Text style={styles.demoButtonText}>
              Sign in as demo user 🧪
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 8,
  },
  description: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  form: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    height: 48,
    marginLeft: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  passwordToggle: {
    padding: 8,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 3,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '500',
  },
  authButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  authButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  socialSection: {
    marginTop: 30,
    alignItems: 'center',
  },
  orText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 20,
  },
  socialButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 15,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 100,
    justifyContent: 'center',
  },
  socialButtonText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
    fontWeight: '500',
  },
  switchButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  switchButtonText: {
    color: '#6366F1',
    fontSize: 14,
  },
  demoButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
  },
  demoButtonText: {
    color: '#6B7280',
    fontSize: 14,
  },
});