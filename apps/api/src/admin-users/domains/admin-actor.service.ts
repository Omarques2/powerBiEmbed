import { Injectable } from '@nestjs/common';
import { UserRepository } from '../repositories/user.repository';

@Injectable()
export class AdminActorService {
  constructor(private readonly users: UserRepository) {}

  async resolveActorUserId(actorSub: string | null): Promise<string | null> {
    if (!actorSub) return null;
    const actor = await this.users.findByIdentitySubject(actorSub);
    return actor?.id ?? null;
  }
}
