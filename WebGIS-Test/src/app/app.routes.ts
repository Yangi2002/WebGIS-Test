import { Routes } from '@angular/router';
import { AppComponent } from './app.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'webgis',
    pathMatch: 'full'
  },
  {
    path: 'webgis',
    component: AppComponent
  },
  {
    path: '**',
    redirectTo: 'webgis'
  }
];