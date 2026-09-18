import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getStatus() {
    return { status: 'ok', message: 'Planova backend running' };
  }
}
