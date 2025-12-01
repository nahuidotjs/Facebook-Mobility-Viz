import { tsvParse } from 'd3-dsv';
import { MovementRecord } from '../types';

export const parseMovementData = (text: string): MovementRecord[] => {
  // Use d3-dsv to parse tab-separated values
  const parsed = tsvParse(text, (d) => {
    // Explicitly convert types
    return {
      ds: d.ds || '',
      country: d.country || '',
      polygon_source: d.polygon_source || '',
      polygon_id: d.polygon_id || '',
      polygon_name: d.polygon_name || '',
      all_day_bing_tiles_visited_relative_change: d.all_day_bing_tiles_visited_relative_change ? parseFloat(d.all_day_bing_tiles_visited_relative_change) : 0,
      all_day_ratio_single_tile_users: d.all_day_ratio_single_tile_users ? parseFloat(d.all_day_ratio_single_tile_users) : 0,
      baseline_name: d.baseline_name || '',
      baseline_type: d.baseline_type || '',
    };
  });

  // Filter out any invalid rows that might have occurred due to empty lines
  return parsed.filter(p => p.ds && p.country) as MovementRecord[];
};

export const getUniqueCountries = (data: MovementRecord[]): string[] => {
  return Array.from(new Set(data.map((d) => d.country))).sort();
};

export const getRegionsByCountry = (data: MovementRecord[], country: string): string[] => {
  return Array.from(
    new Set(data.filter((d) => d.country === country).map((d) => d.polygon_name))
  ).sort();
};
