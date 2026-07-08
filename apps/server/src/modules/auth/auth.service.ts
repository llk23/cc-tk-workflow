import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
  async login(username: string, _password: string) {
    return { token: `mock_token_${username}`, user: { username } };
  }
}
