import { isDevMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { injectSpeedInsights } from '@vercel/speed-insights';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .then(() => {
    if (!isDevMode()) {
      injectSpeedInsights({ framework: 'angular' });
    }
  })
  .catch((err) => console.error(err));
