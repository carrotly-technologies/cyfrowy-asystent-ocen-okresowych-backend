import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthenticationModule } from '@nestjs/authentication';
import { AuthController } from './auth.controller.js';
import { CasePolicy } from './case.policy.js';
import { CredentialsService } from './credentials.service.js';
import { readJwtSecret } from './jwt-secret.js';
import { JwtAuth } from './jwt.auth.js';
import { RolePolicy } from './role.policy.js';
import { DATABASE, type Database } from '../database/database.js';
import { DemoModule } from '../demo/demo.module.js';
import { PostgresUsersRepository } from './postgres-users.repository.js';
import { UsersSeeder } from './users-seeder.service.js';
import { InMemoryUsersRepository } from './users.in-memory.repository.js';
import { UsersRepository } from './users.repository.js';

/** Bearer JWT (HS256, 8 h). Import before AuthorizationModule (guard order). */
export const AuthenticationRoot = AuthenticationModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const key = readJwtSecret(config);
    return {
      accessToken: {
        key,
        ttl: '8h',
        // An operator's shorter JWT_SECRET still works (the package warns).
        allowShortSecret: Buffer.byteLength(key) < 32,
      },
      refreshToken: false,
    };
  },
});

@Global()
@Module({
  imports: [DemoModule],
  controllers: [AuthController],
  providers: [
    {
      provide: UsersRepository,
      inject: [DATABASE],
      useFactory: (db: Database | null): UsersRepository =>
        db ? new PostgresUsersRepository(db) : new InMemoryUsersRepository(),
    },
    UsersSeeder,
    CredentialsService,
    JwtAuth,
    RolePolicy,
    CasePolicy,
  ],
  exports: [UsersRepository],
})
export class AuthModule {}
