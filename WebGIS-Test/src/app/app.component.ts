import {
  Component,
  AfterViewInit,
  Inject,
  PLATFORM_ID
} from '@angular/core';

import {
  CommonModule,
  isPlatformBrowser
} from '@angular/common';

import { FormsModule } from '@angular/forms';

import type * as Leaflet from 'leaflet';

interface SearchResult {
  index: number;
  label: string;
  matchedField: string;
  matchedValue: string;
  properties: any;
  feature: any;
}

@Component({
  selector: 'app-webgis',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements AfterViewInit {
  message = 'Ready to upload shapefile.';

  private L!: typeof Leaflet;
  private map!: Leaflet.Map;
  private uploadedLayer?: Leaflet.GeoJSON;
  private highlightedLayer?: Leaflet.GeoJSON;
  private layerControl?: Leaflet.Control.Layers;
  private legendControl?: Leaflet.Control;

  selectedFile?: File;

  attributeFields: string[] = [];
  selectedColorField = '';
  geojsonData: any;

  searchTerm = '';
  searchResults: SearchResult[] = [];
  selectedFeatureProperties: any = null;

    isSidebarCollapsed = false;

    toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;

    setTimeout(() => {
        if (this.map) {
        this.map.invalidateSize();
        }
    }, 300);
    }

  readonly preferredFields = [
    'district',
    'DISTRICT',
    'District',
    'NAME_2',
    'name_2',
    'city',
    'CITY',
    'City',
    'NAME_1',
    'name_1',
    'region',
    'REGION',
    'Region',
    'name',
    'NAME',
    'Name'
  ];

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  async ngAfterViewInit(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.L = await import('leaflet') as typeof Leaflet;

    setTimeout(() => {
      this.initMap();
    }, 0);
  }

  private initMap(): void {
    const osm = this.L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: '&copy; OpenStreetMap contributors'
      }
    );

    const satellite = this.L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Tiles &copy; Esri'
      }
    );

    this.map = this.L.map('map', {
      center: [10.7769, 106.7009],
      zoom: 8,
      layers: [osm]
    });

    this.layerControl = this.L.control.layers(
      {
        'OpenStreetMap Raster': osm,
        'Satellite Raster': satellite
      },
      {},
      {
        collapsed: false
      }
    ).addTo(this.map);

    this.L.control.scale().addTo(this.map);

    setTimeout(() => {
      this.map.invalidateSize();
    }, 300);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (!input.files || input.files.length === 0) {
      return;
    }

    this.selectedFile = input.files[0];
    this.message = `Selected file: ${this.selectedFile.name}`;
  }

  uploadShapefile(): void {
    if (!this.selectedFile) {
      alert('Please select a zipped shapefile first.');
      return;
    }

    if (!this.selectedFile.name.toLowerCase().endsWith('.zip')) {
      alert('Please upload a zipped shapefile file.');
      return;
    }

    const formData = new FormData();
    formData.append('shapefile', this.selectedFile);

    this.message = 'Uploading and converting shapefile...';

    fetch('/api/upload-shapefile', {
      method: 'POST',
      body: formData
    })
      .then(res => res.json())
      .then(data => {
        if (!data.geojson) {
          this.message = data.message || 'Cannot read shapefile.';
          alert(this.message);
          return;
        }

        this.geojsonData = this.normalizeGeoJSON(data.geojson);

        this.extractAttributeFields();
        this.selectedColorField = this.guessBestColorField();

        this.searchTerm = '';
        this.searchResults = [];
        this.selectedFeatureProperties = null;
        this.clearHighlight();

        this.displayGeoJSON();

        this.message = 'Shapefile displayed successfully.';
      })
      .catch(err => {
        console.error(err);
        this.message = 'Upload failed.';
        alert('Upload failed. Check backend, proxy, and shapefile zip.');
      });
  }

  private normalizeGeoJSON(input: any): any {
    if (Array.isArray(input)) {
      const features = input.flatMap(item => item.features || []);

      return {
        type: 'FeatureCollection',
        features
      };
    }

    return input;
  }

  private extractAttributeFields(): void {
    const firstFeature = this.geojsonData?.features?.[0];

    if (!firstFeature || !firstFeature.properties) {
      this.attributeFields = [];
      return;
    }

    this.attributeFields = Object.keys(firstFeature.properties);
  }

  private guessBestColorField(): string {
    for (const field of this.preferredFields) {
      if (this.attributeFields.includes(field)) {
        return field;
      }
    }

    return this.attributeFields[0] || '';
  }

  displayGeoJSON(): void {
    if (!this.geojsonData || !this.map || !this.L) {
      return;
    }

    if (this.uploadedLayer) {
      this.layerControl?.removeLayer(this.uploadedLayer);
      this.map.removeLayer(this.uploadedLayer);
    }

    const colorField = this.selectedColorField;

    this.uploadedLayer = this.L.geoJSON(this.geojsonData, {
      style: (feature: any) => {
        const value = feature?.properties?.[colorField] || 'default';

        return {
          color: '#333333',
          weight: 1,
          fillColor: this.getColor(value),
          fillOpacity: 0.65
        };
      },

      pointToLayer: (feature: any, latlng: Leaflet.LatLng) => {
        const value = feature?.properties?.[colorField] || 'default';

        return this.L.circleMarker(latlng, {
          radius: 6,
          color: '#333333',
          weight: 1,
          fillColor: this.getColor(value),
          fillOpacity: 0.85
        });
      },

      onEachFeature: (feature: any, layer: any) => {
        const popupContent = this.createPopupContent(feature.properties);
        layer.bindPopup(popupContent);
      }
    }).addTo(this.map);

    this.layerControl?.addOverlay(
      this.uploadedLayer,
      'Uploaded Vector Layer'
    );

    const bounds = this.uploadedLayer.getBounds();

    if (bounds.isValid()) {
      this.map.fitBounds(bounds);
    }

    this.addLegend();
  }

  searchFeatures(): void {
    if (!this.geojsonData || !this.geojsonData.features) {
      alert('Please upload a shapefile first.');
      return;
    }

    const query = this.normalizeText(this.searchTerm);

    if (!query) {
      alert('Please enter a search keyword.');
      return;
    }

    this.clearHighlight();
    this.selectedFeatureProperties = null;

    const features = this.geojsonData.features;

    const results = features
      .map((feature: any, index: number) => {
        const properties = feature.properties || {};

        for (const field of this.preferredFields) {
          if (!Object.prototype.hasOwnProperty.call(properties, field)) {
            continue;
          }

          const value = properties[field];

          if (this.normalizeText(value).includes(query)) {
            return {
              index,
              label: this.getFeatureLabel(properties),
              matchedField: field,
              matchedValue: String(value),
              properties,
              feature
            } as SearchResult;
          }
        }

        return null;
      })
      .filter((result: SearchResult | null): result is SearchResult => result !== null);

    this.searchResults = results;

    if (this.searchResults.length === 0) {
      this.message = 'No matching area found.';
      alert('No matching area found.');
      return;
    }

    this.message = `${this.searchResults.length} result(s) found.`;

    if (this.searchResults.length === 1) {
      this.selectSearchResult(this.searchResults[0]);
    }
  }

  selectSearchResult(result: SearchResult): void {
    if (!this.L || !this.map) {
      return;
    }

    this.clearHighlight();

    this.selectedFeatureProperties = result.properties;

    this.highlightedLayer = this.L.geoJSON(result.feature, {
      style: () => {
        return {
          color: '#ff0000',
          weight: 4,
          fillColor: '#ffff00',
          fillOpacity: 0.75
        };
      },

      pointToLayer: (feature: any, latlng: Leaflet.LatLng) => {
        return this.L.circleMarker(latlng, {
          radius: 9,
          color: '#ff0000',
          weight: 3,
          fillColor: '#ffff00',
          fillOpacity: 0.95
        });
      },

      onEachFeature: (feature: any, layer: any) => {
        layer.bindPopup(this.createPopupContent(feature.properties));
      }
    }).addTo(this.map);

    const bounds = this.highlightedLayer.getBounds();

    if (bounds.isValid()) {
      this.map.fitBounds(bounds, {
        padding: [30, 30]
      });
    }

    this.highlightedLayer.openPopup();

    this.message = `Selected: ${result.label}`;
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.searchResults = [];
    this.selectedFeatureProperties = null;
    this.clearHighlight();
    this.message = 'Search cleared.';
  }

  private clearHighlight(): void {
    if (this.highlightedLayer) {
      this.map.removeLayer(this.highlightedLayer);
      this.highlightedLayer = undefined;
    }
  }

  private normalizeText(value: any): string {
    return String(value ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private getFeatureLabel(properties: any): string {
    for (const field of this.preferredFields) {
      if (
        Object.prototype.hasOwnProperty.call(properties, field) &&
        properties[field]
      ) {
        return String(properties[field]);
      }
    }

    return 'Unknown feature';
  }

  getPropertyKeys(properties: any): string[] {
    if (!properties) {
      return [];
    }

    return Object.keys(properties);
  }

  private getColor(value: string): string {
    const colors = [
      '#e6194b',
      '#3cb44b',
      '#ffe119',
      '#4363d8',
      '#f58231',
      '#911eb4',
      '#46f0f0',
      '#f032e6',
      '#bcf60c',
      '#fabebe',
      '#008080',
      '#e6beff'
    ];

    let hash = 0;
    const text = String(value);

    for (let i = 0; i < text.length; i++) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }

    return colors[Math.abs(hash) % colors.length];
  }

  private createPopupContent(properties: any): string {
    if (!properties) {
      return 'No attribute data';
    }

    let html = '<div class="popup-table">';
    html += '<h4>Feature Information</h4>';
    html += '<table>';

    Object.keys(properties).forEach(key => {
      html += `
        <tr>
          <td><b>${key}</b></td>
          <td>${properties[key]}</td>
        </tr>
      `;
    });

    html += '</table>';
    html += '</div>';

    return html;
  }

  private addLegend(): void {
    if (this.legendControl) {
      this.map.removeControl(this.legendControl);
    }

    const legend = new this.L.Control({
      position: 'bottomright'
    });

    legend.onAdd = () => {
      const div = this.L.DomUtil.create('div', 'legend');

      div.innerHTML = `
        <h4>Legend</h4>
        <div>
          <span class="legend-box"></span>
          Uploaded vector layer
        </div>
        <div>
          Colored by:
          <b>${this.selectedColorField || 'N/A'}</b>
        </div>
        <hr>
        <div>
          Raster: OpenStreetMap / Satellite
        </div>
      `;

      return div;
    };

    legend.addTo(this.map);

    this.legendControl = legend;
  }
}