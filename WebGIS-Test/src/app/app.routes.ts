import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'webgis',
    pathMatch: 'full'
  },
  {
    path: 'webgis',
    loadComponent: () =>
      import('./webgis/webgis.component').then(m => m.WebgisComponent)
  },
  {
    path: '**',
    redirectTo: 'webgis'
  }
];