export interface AuthUser {
  authenticated: true;
  username: string;
  email: string;
  name: string;
  groups: string[];
  avatarUrl: string | null;
}

export interface AuthUnauthenticated {
  authenticated: false;
}

export type AuthState = AuthUser | AuthUnauthenticated;
