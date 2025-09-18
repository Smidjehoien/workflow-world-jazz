import type {
  AuthInfo,
  AuthProvider,
  HealthCheckResponse,
} from '../world/index.js';

export const auth: AuthProvider = {
  async getAuthInfo(): Promise<AuthInfo> {
    return {
      ownerId: 'embedded-owner',
      projectId: 'embedded-project',
      environment: 'embedded',
      userId: 'embedded-user',
    };
  },

  async checkHealth(): Promise<HealthCheckResponse> {
    return {
      success: true,
      data: { healthy: true },
      message: 'Embedded backend is healthy',
    };
  },
};
