
import { AuthService } from '../utils/authService';

describe('AuthService', () => {
  beforeEach(async () => {
    await AuthService.logout();
  });

  it('should not be authenticated by default', async () => {
    expect(await AuthService.isAuthenticated()).toBe(false);
  });

  it('should store tokens in memory after login', async () => {
    AuthService.setTokens({ accessToken: 'access', refreshToken: 'refresh' });
    expect(await AuthService.isAuthenticated()).toBe(true);
    expect(await AuthService.getToken()).toBe('access');
    expect(await AuthService.getRefreshToken()).toBe('refresh');
  });

  it('should clear tokens on logout', async () => {
    AuthService.setTokens({ accessToken: 'access', refreshToken: 'refresh' });
    await AuthService.logout();
    expect(await AuthService.isAuthenticated()).toBe(false);
    expect(await AuthService.getToken()).toBeNull();
    expect(await AuthService.getRefreshToken()).toBeNull();
  });

  it('should call refreshToken on ensureValidToken if token invalid', async () => {
    const spy = jest.spyOn(AuthService, 'refreshToken').mockResolvedValue(true);
    AuthService.setTokens({ accessToken: 'expired', refreshToken: 'refresh' });
    await AuthService.ensureValidToken();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
