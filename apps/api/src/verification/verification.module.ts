import { Module } from '@nestjs/common';

import { VerificationRepository } from './verification.repository';
import { VerificationService } from './verification.service';

@Module({
  providers: [VerificationRepository, VerificationService],
  exports: [VerificationService],
})
export class VerificationModule {}
