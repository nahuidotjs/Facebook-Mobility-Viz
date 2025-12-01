export interface MovementRecord {
  ds: string; // Date string YYYY-MM-DD
  country: string;
  polygon_source: string;
  polygon_id: string;
  polygon_name: string;
  all_day_bing_tiles_visited_relative_change: number;
  all_day_ratio_single_tile_users: number;
  baseline_name: string;
  baseline_type: string;
}

export interface FilterState {
  selectedCountry: string | null;
  selectedRegion: string | null;
}

export interface AggregatedStats {
  avgMobilityChange: number;
  maxStayHomeRatio: number;
  totalRecords: number;
  dateRange: { start: string; end: string };
}
