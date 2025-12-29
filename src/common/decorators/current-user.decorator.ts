import { createParamDecorator, ExecutionContext } from '@nestjs/common';

interface RequestWithUser {
  user?: {
    uid?: string;
    email?: string;
    [key: string]: unknown;
  };
}

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // If a property name is provided (e.g., 'uid'), extract that property
    if (data && user) {
      return user[data];
    }

    // Otherwise return the whole user object
    return user;
  },
);
