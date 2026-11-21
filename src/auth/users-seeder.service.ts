import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { DemoReset } from '../demo/demo-reset.service.js';
import { UsersRepository } from './users.repository.js';
import { USER_SEED } from './users.seed.js';

/**
 * Loads the demo accounts into empty storage only (accounts already in the
 * database are kept); POST /api/demo/reset restores them.
 */
@Injectable()
export class UsersSeeder implements OnModuleInit {
  constructor(
    @Inject(UsersRepository) private readonly users: UsersRepository,
    private readonly demoReset: DemoReset,
  ) {}

  async onModuleInit(): Promise<void> {
    this.demoReset.register(() => this.reset());
    if (await this.users.isEmpty()) await this.reset();
  }

  reset(): Promise<void> {
    return this.users.replaceAll(USER_SEED);
  }
}
