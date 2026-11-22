import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { toUserView, type UserView } from '../auth/user.types.js';
import { UsersRepository } from '../auth/users.repository.js';
import { EmployeesRepository } from '../employees/employees.repository.js';
import {
  accountId,
  suggestLogin,
  temporaryPassword,
} from './accounts.rules.js';
import type { CreateAccountInput } from './admin.schemas.js';

export interface CreatedAccount {
  account: UserView;
  /** Shown once; only its scrypt hash is stored. */
  temporaryPassword: string;
}

export interface PersonAccount {
  account: UserView | null;
  suggestedLogin: string;
}

/**
 * EMPLOYEE accounts for people from the HR register (kartoteka). In
 * production accounts come from the office's LDAP/AD through UsersRepository.
 */
@Injectable()
export class AccountsService {
  constructor(
    private readonly users: UsersRepository,
    private readonly employees: EmployeesRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  async forPerson(personId: string): Promise<PersonAccount> {
    const employee = await this.employees.findEmployee(personId);
    if (!employee) throw new NotFoundException(notFound(personId));
    const account = await this.users.findByPersonId(personId);
    return {
      account: account ? toUserView(account) : null,
      suggestedLogin: suggestLogin(employee.firstName, employee.lastName),
    };
  }

  async create({
    personId,
    login,
  }: CreateAccountInput): Promise<CreatedAccount> {
    const employee = await this.employees.findEmployee(personId);
    if (!employee) throw new NotFoundException(notFound(personId));
    const existing = await this.users.findByPersonId(personId);
    if (existing) {
      throw new ConflictException(
        `Pracownik ma już konto „${existing.login}”.`,
      );
    }
    if (await this.users.findCredentials(login)) {
      throw new ConflictException(`Login „${login}” jest już zajęty.`);
    }
    const id = await this.freeId(accountId(login));
    const password = temporaryPassword();
    const account = await this.users.insert({
      id,
      login,
      firstName: employee.firstName,
      lastName: employee.lastName,
      role: 'EMPLOYEE',
      position: employee.position,
      unit: employee.unit,
      evaluatorId: null,
      personId,
      passwordHash: await this.hasher.hash(password),
    });
    return { account: toUserView(account), temporaryPassword: password };
  }

  private async freeId(base: string): Promise<string> {
    let id = base;
    for (let n = 2; await this.users.findById(id); n++) id = `${base}-${n}`;
    return id;
  }
}

const notFound = (id: string) => `Nie ma pracownika „${id}” w kartotece.`;
