import { Global, Module } from '@nestjs/common';
import { getDb, type Db } from './client';

export const DB = Symbol('DB');
export type { Db };

@Global()
@Module({
  providers: [
    {
      provide: DB,
      useFactory: () => getDb(),
    },
  ],
  exports: [DB],
})
export class DbModule {}
