import { initBotId } from 'botid/client/core';

initBotId({
  protect: [
    { path: '/api/auth/bootstrap', method: 'POST' },
    { path: '/api/blob/upload', method: 'POST' },
  ],
});
