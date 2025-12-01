import React, { useMemo, useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  ReferenceLine,
} from 'recharts';
import { 
  Activity, 
  Home, 
  Calendar, 
  Users, 
  Filter, 
  XCircle, 
  GitCompare, 
  LayoutTemplate,
  ArrowUpDown,
  MapPin,
  Globe,
  Map as MapIcon
} from 'lucide-react';
import { MovementRecord } from '../types';
import { getRegionsByCountry, getUniqueCountries } from '../services/dataService';

const WHOLE_COUNTRY_OPTION = '(Whole Country Average)';

interface ChartDataPoint {
  ds: string;
  primary_mobility: number | null;
  primary_stay: number | null;
  primary_label?: string;
  secondary_mobility?: number;
  secondary_stay?: number;
  secondary_label?: string;
}

interface RegionStats {
  name: string;
  avgMobility: number;
  avgStay: number;
  maxStay: number;
  minMobility: number;
  dataPoints: number;
}

interface NormalizedDataPoint {
  ds: string;
  mobility: number;
  stay: number;
  baseline_type?: string;
}

interface DashboardProps {
  data: MovementRecord[];
  onReset: () => void;
}

// Helper to calculate country-wide aggregates
const calculateCountryAggregates = (data: MovementRecord[], country: string) => {
  if (!country) return null;
  const raw = data.filter(d => d.country === country);
  if (raw.length === 0) return null;

  // 1. Aggregated Trend (Avg per day)
  const dateMap = new Map<string, { count: number; mobSum: number; staySum: number }>();
  
  // 2. Region Matrix Data
  const regionMap = new Map<string, RegionStats>();

  raw.forEach(r => {
    // Trend Accumulation
    if (!dateMap.has(r.ds)) dateMap.set(r.ds, { count: 0, mobSum: 0, staySum: 0 });
    const dEntry = dateMap.get(r.ds)!;
    dEntry.count++;
    dEntry.mobSum += r.all_day_bing_tiles_visited_relative_change;
    dEntry.staySum += r.all_day_ratio_single_tile_users;

    // Region Accumulation
    if (!regionMap.has(r.polygon_name)) {
      regionMap.set(r.polygon_name, { 
        name: r.polygon_name, 
        avgMobility: 0, 
        avgStay: 0, 
        maxStay: -1, 
        minMobility: 999,
        dataPoints: 0 
      });
    }
    const rEntry = regionMap.get(r.polygon_name)!;
    rEntry.avgMobility += r.all_day_bing_tiles_visited_relative_change;
    rEntry.avgStay += r.all_day_ratio_single_tile_users;
    rEntry.maxStay = Math.max(rEntry.maxStay, r.all_day_ratio_single_tile_users);
    rEntry.minMobility = Math.min(rEntry.minMobility, r.all_day_bing_tiles_visited_relative_change);
    rEntry.dataPoints++;
  });

  // Finalize Trend
  const trend = Array.from(dateMap.entries()).map(([ds, val]) => ({
    ds,
    avgMobility: val.mobSum / val.count,
    avgStay: val.staySum / val.count
  })).sort((a, b) => new Date(a.ds).getTime() - new Date(b.ds).getTime());

  // Finalize Matrix
  const matrix = Array.from(regionMap.values()).map(r => ({
    ...r,
    avgMobility: r.avgMobility / r.dataPoints,
    avgStay: r.avgStay / r.dataPoints
  }));

  return { trend, matrix, totalRegions: regionMap.size };
};

// Helper to format a single region's data as an aggregate structure (for polymorphic usage)
const calculateRegionAsAggregate = (dataset: NormalizedDataPoint[], regionName: string) => {
  if (dataset.length === 0) return null;

  // Trend
  const trend = dataset.map(d => ({
    ds: d.ds,
    avgMobility: d.mobility,
    avgStay: d.stay
  }));

  // Matrix (Single Row)
  const mobilityVals = dataset.map(d => d.mobility);
  const stayVals = dataset.map(d => d.stay);
  
  const avgMobility = mobilityVals.reduce((a, b) => a + b, 0) / mobilityVals.length;
  const avgStay = stayVals.reduce((a, b) => a + b, 0) / stayVals.length;
  const minMobility = Math.min(...mobilityVals);
  const maxStay = Math.max(...stayVals);

  const matrix: RegionStats[] = [{
     name: regionName,
     avgMobility,
     avgStay,
     maxStay,
     minMobility,
     dataPoints: dataset.length
  }];

  return { trend, matrix, totalRegions: 1 };
};

const Dashboard: React.FC<DashboardProps> = ({ data, onReset }) => {
  const countries = useMemo(() => getUniqueCountries(data), [data]);
  const [viewMode, setViewMode] = useState<'region' | 'country'>('country');
  
  // ==========================================
  // VIEW 1: COMPARATIVE ANALYSIS (Region/Country)
  // ==========================================
  const [selectedCountry, setSelectedCountry] = useState<string>(countries[0] || '');
  
  // Add Whole Country Option to list
  const primaryRegions = useMemo(() => {
    const regions = getRegionsByCountry(data, selectedCountry);
    return [WHOLE_COUNTRY_OPTION, ...regions];
  }, [data, selectedCountry]);
  
  const [selectedRegion, setSelectedRegion] = useState<string>(primaryRegions[0] || '');

  // Reset region when country changes
  useEffect(() => {
    if (selectedCountry && !primaryRegions.includes(selectedRegion)) {
      setSelectedRegion(primaryRegions[0] || '');
    }
  }, [selectedCountry, primaryRegions, selectedRegion]);

  const [isCompareMode, setIsCompareMode] = useState(false);
  const [selectedCountry2, setSelectedCountry2] = useState<string>(countries[0] || '');
  
  const secondaryRegions = useMemo(() => {
    const regions = getRegionsByCountry(data, selectedCountry2);
    return [WHOLE_COUNTRY_OPTION, ...regions];
  }, [data, selectedCountry2]);

  const [selectedRegion2, setSelectedRegion2] = useState<string>('');

  useEffect(() => {
    if (isCompareMode && selectedCountry2 && !secondaryRegions.includes(selectedRegion2)) {
      setSelectedRegion2(secondaryRegions[0] || '');
    }
  }, [selectedCountry2, secondaryRegions, selectedRegion2, isCompareMode]);

  // ==========================================
  // VIEW 2: COUNTRY OVERVIEW STATE
  // ==========================================
  const [countryViewCountry, setCountryViewCountry] = useState<string>(countries[0] || '');
  const [isCountryCompareMode, setIsCountryCompareMode] = useState(false);
  
  // Comparison Type: Compare against another country OR a specific region in the same country
  const [countryCompareType, setCountryCompareType] = useState<'country' | 'region'>('country');
  const [countryViewCountry2, setCountryViewCountry2] = useState<string>(countries.length > 1 ? countries[1] : countries[0] || '');
  const [countryViewRegion, setCountryViewRegion] = useState<string>('');

  // Available regions for the Country Overview comparison
  const countryViewAvailableRegions = useMemo(() => {
      return getRegionsByCountry(data, countryViewCountry);
  }, [data, countryViewCountry]);

  // Auto-select first region if switching to region compare mode
  useEffect(() => {
      if (countryCompareType === 'region' && countryViewAvailableRegions.length > 0 && !countryViewAvailableRegions.includes(countryViewRegion)) {
          setCountryViewRegion(countryViewAvailableRegions[0]);
      }
  }, [countryCompareType, countryViewAvailableRegions, countryViewRegion]);
  
  const [sortConfig, setSortConfig] = useState<{key: keyof RegionStats, direction: 'asc' | 'desc'} | null>({ key: 'avgMobility', direction: 'asc' });
  const [matrixTab, setMatrixTab] = useState<'primary' | 'secondary'>('primary');

  // ==========================================
  // DATA PROCESSING
  // ==========================================

  // --- Helper: Get Normalized Series (Raw or Aggregated) ---
  const getNormalizedSeries = (c: string, r: string): NormalizedDataPoint[] => {
    if (!c || !r) return [];

    // Case A: Whole Country Average
    if (r === WHOLE_COUNTRY_OPTION) {
        const agg = calculateCountryAggregates(data, c);
        if (!agg) return [];
        return agg.trend.map(t => ({
            ds: t.ds,
            mobility: t.avgMobility,
            stay: t.avgStay,
            baseline_type: 'AVERAGE'
        }));
    }

    // Case B: Specific Region
    const filtered = data.filter((d) => d.country === c && d.polygon_name === r);
    return filtered
        .sort((a, b) => new Date(a.ds).getTime() - new Date(b.ds).getTime())
        .map(d => ({
            ds: d.ds,
            mobility: d.all_day_bing_tiles_visited_relative_change,
            stay: d.all_day_ratio_single_tile_users,
            baseline_type: d.baseline_type
        }));
  };

  const calculateStats = (dataset: NormalizedDataPoint[]) => {
    if (dataset.length === 0) return null;
    const mobilityChanges = dataset.map((d) => d.mobility);
    const stayHomeRatios = dataset.map((d) => d.stay);
    
    const avgMobility = mobilityChanges.reduce((a, b) => a + b, 0) / mobilityChanges.length;
    const maxStayHome = Math.max(...stayHomeRatios);
    
    return {
      avgMobility: (avgMobility * 100).toFixed(1),
      maxStayHome: (maxStayHome * 100).toFixed(1),
      count: dataset.length,
      start: dataset[0].ds,
      end: dataset[dataset.length - 1].ds,
    };
  };

  // --- Region Comparison Data ---
  const primaryData = useMemo(() => getNormalizedSeries(selectedCountry, selectedRegion), [selectedCountry, selectedRegion, data]);
  const secondaryData = useMemo(() => isCompareMode ? getNormalizedSeries(selectedCountry2, selectedRegion2) : [], [isCompareMode, selectedCountry2, selectedRegion2, data]);

  const comparisonChartData = useMemo(() => {
    const dataMap = new Map<string, ChartDataPoint>();
    
    primaryData.forEach(d => {
      dataMap.set(d.ds, {
        ds: d.ds,
        primary_mobility: d.mobility,
        primary_stay: d.stay,
        primary_label: selectedRegion === WHOLE_COUNTRY_OPTION ? `${selectedCountry} (Avg)` : selectedRegion
      });
    });

    if (isCompareMode && secondaryData.length > 0) {
      secondaryData.forEach(d => {
        const existing: ChartDataPoint = dataMap.get(d.ds) || { 
            ds: d.ds,
            primary_mobility: null,
            primary_stay: null
        };
        existing.secondary_mobility = d.mobility;
        existing.secondary_stay = d.stay;
        existing.secondary_label = selectedRegion2 === WHOLE_COUNTRY_OPTION ? `${selectedCountry2} (Avg)` : selectedRegion2;
        dataMap.set(d.ds, existing);
      });
    }

    return Array.from(dataMap.values()).sort((a, b) => new Date(a.ds).getTime() - new Date(b.ds).getTime());
  }, [primaryData, secondaryData, isCompareMode, selectedRegion, selectedCountry, selectedRegion2, selectedCountry2]);

  const stats = useMemo(() => calculateStats(primaryData), [primaryData]);
  const stats2 = useMemo(() => isCompareMode ? calculateStats(secondaryData) : null, [secondaryData, isCompareMode]);


  // --- Country Overview Data ---
  const countryOverviewData1 = useMemo(() => calculateCountryAggregates(data, countryViewCountry), [data, countryViewCountry]);
  
  // Dynamic Calculation for Comparison Data (Country vs Country OR Country vs Region)
  const countryOverviewData2 = useMemo(() => {
      if (!isCountryCompareMode) return null;

      if (countryCompareType === 'country') {
          // Compare with another country
          return calculateCountryAggregates(data, countryViewCountry2);
      } else {
          // Compare with a region in the same country
          // Reuse getNormalizedSeries to fetch raw data, then shape it like an aggregate
          const regionSeries = getNormalizedSeries(countryViewCountry, countryViewRegion);
          return calculateRegionAsAggregate(regionSeries, countryViewRegion);
      }
  }, [data, countryViewCountry2, countryViewRegion, isCountryCompareMode, countryCompareType, countryViewCountry]);

  const countryComparisonChartData = useMemo(() => {
    if (!countryOverviewData1) return [];
    
    const dataMap = new Map<string, ChartDataPoint>();
    
    countryOverviewData1.trend.forEach(d => {
      dataMap.set(d.ds, {
        ds: d.ds,
        primary_mobility: d.avgMobility,
        primary_stay: d.avgStay,
        primary_label: countryViewCountry
      });
    });

    if (isCountryCompareMode && countryOverviewData2) {
      const secondaryLabel = countryCompareType === 'country' ? countryViewCountry2 : countryViewRegion;

      countryOverviewData2.trend.forEach(d => {
        const existing: ChartDataPoint = dataMap.get(d.ds) || {
          ds: d.ds,
          primary_mobility: null,
          primary_stay: null,
          primary_label: countryViewCountry
        };
        existing.secondary_mobility = d.avgMobility;
        existing.secondary_stay = d.avgStay;
        existing.secondary_label = secondaryLabel;
        dataMap.set(d.ds, existing);
      });
    }

    return Array.from(dataMap.values()).sort((a, b) => new Date(a.ds).getTime() - new Date(b.ds).getTime());
  }, [countryOverviewData1, countryOverviewData2, isCountryCompareMode, countryViewCountry, countryViewCountry2, countryCompareType, countryViewRegion]);


  const sortedMatrix = useMemo(() => {
    const activeData = (matrixTab === 'secondary' && isCountryCompareMode && countryOverviewData2) 
      ? countryOverviewData2 
      : countryOverviewData1;

    if (!activeData?.matrix) return [];
    let sortable = [...activeData.matrix];
    if (sortConfig) {
      sortable.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortable;
  }, [countryOverviewData1, countryOverviewData2, sortConfig, matrixTab, isCountryCompareMode]);

  const handleSort = (key: keyof RegionStats) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };


  if (!selectedCountry && !countryViewCountry) {
    return <div className="text-center p-10">No data available.</div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="flex items-center space-x-3">
            <Activity className="w-6 h-6 text-blue-400" />
            <h1 className="text-xl font-bold tracking-tight">Movement Range Tracker</h1>
          </div>
          
          <div className="flex bg-slate-800 p-1 rounded-lg">
             <button
               onClick={() => setViewMode('country')}
               className={`flex items-center px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                 viewMode === 'country' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
               }`}
             >
               <LayoutTemplate className="w-4 h-4 mr-2" />
               Country Overview
             </button>
             <button
               onClick={() => setViewMode('region')}
               className={`flex items-center px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                 viewMode === 'region' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
               }`}
             >
               <GitCompare className="w-4 h-4 mr-2" />
               Comparative Analysis
             </button>
          </div>

          <button
            onClick={onReset}
            className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-full transition-colors flex items-center border border-slate-700"
          >
            <XCircle className="w-3 h-3 mr-1.5" />
            Upload New File
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* ========================================================================================= */}
          {/* VIEW: COUNTRY OVERVIEW */}
          {/* ========================================================================================= */}
          {viewMode === 'country' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
               {/* Controls */}
               <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-4">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-blue-50 rounded-lg">
                           <Globe className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <h2 className="text-lg font-bold text-slate-800">Country Analysis</h2>
                          <p className="text-sm text-slate-500">Aggregated stats & regional breakdown</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setIsCountryCompareMode(!isCountryCompareMode)}
                        className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          isCountryCompareMode 
                            ? 'bg-purple-100 text-purple-700 border border-purple-200 shadow-sm' 
                            : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        <GitCompare className="w-4 h-4 mr-2" />
                        {isCountryCompareMode ? 'Disable Comparison' : 'Compare'}
                      </button>
                  </div>

                  <div className="flex flex-col md:flex-row gap-6">
                      <div className="w-full md:w-1/3">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center">
                          <span className="w-2 h-2 rounded-full bg-blue-600 mr-2"></span>
                          Primary Country
                        </label>
                        <select
                          className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                          value={countryViewCountry}
                          onChange={(e) => setCountryViewCountry(e.target.value)}
                        >
                          {countries.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      {isCountryCompareMode && (
                         <div className="w-full md:w-2/3 animate-in fade-in slide-in-from-right-4">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center">
                               <span className="w-2 h-2 rounded-full bg-purple-600 mr-2"></span>
                               Comparison Source
                            </label>
                            
                            <div className="flex flex-col md:flex-row gap-4">
                                {/* Type Selector */}
                                <div className="flex bg-slate-100 rounded-lg p-1 h-10 min-w-fit">
                                    <button 
                                        onClick={() => setCountryCompareType('country')}
                                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${countryCompareType === 'country' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Another Country
                                    </button>
                                    <button 
                                        onClick={() => setCountryCompareType('region')}
                                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${countryCompareType === 'region' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Region in {countryViewCountry}
                                    </button>
                                </div>

                                {/* Value Selector */}
                                <div className="flex-1">
                                    {countryCompareType === 'country' ? (
                                        <select
                                          className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block p-2.5 h-10"
                                          value={countryViewCountry2}
                                          onChange={(e) => setCountryViewCountry2(e.target.value)}
                                        >
                                          {countries.map((c) => (
                                            <option key={c} value={c}>{c}</option>
                                          ))}
                                        </select>
                                    ) : (
                                        <select
                                          className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block p-2.5 h-10"
                                          value={countryViewRegion}
                                          onChange={(e) => setCountryViewRegion(e.target.value)}
                                        >
                                          {countryViewAvailableRegions.map((r) => (
                                            <option key={r} value={r}>{r}</option>
                                          ))}
                                        </select>
                                    )}
                                </div>
                            </div>
                         </div>
                      )}
                  </div>
               </div>

               {countryOverviewData1 && (
                 <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                       <p className="text-sm text-slate-500 font-medium mb-1">Total Regions Tracked</p>
                       <div className="flex flex-col gap-1">
                          <div className="flex items-center">
                             <MapPin className="w-5 h-5 text-indigo-500 mr-2" />
                             <span className="text-2xl font-bold text-slate-800">{countryOverviewData1.totalRegions}</span>
                             {isCountryCompareMode && <span className="ml-2 text-xs font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">Pri</span>}
                          </div>
                          {isCountryCompareMode && countryOverviewData2 && (
                             <div className="flex items-center pt-2 border-t border-slate-100">
                                <span className="text-xl font-bold text-slate-600 ml-7">{countryOverviewData2.totalRegions}</span>
                                <span className="ml-2 text-xs font-semibold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">Cmp</span>
                             </div>
                          )}
                       </div>
                    </div>
                    
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                       <p className="text-sm text-slate-500 font-medium mb-1">Avg Mobility Change</p>
                       <div className="flex flex-col gap-1">
                          <div className="flex items-center">
                            <Activity className="w-5 h-5 text-blue-500 mr-2" />
                            <span className={`text-2xl font-bold ${
                              (countryOverviewData1.matrix.reduce((sum, r) => sum + r.avgMobility, 0) / countryOverviewData1.totalRegions) < 0 
                              ? 'text-red-600' : 'text-green-600'
                            }`}>
                              {((countryOverviewData1.matrix.reduce((sum, r) => sum + r.avgMobility, 0) / countryOverviewData1.totalRegions) * 100).toFixed(1)}%
                            </span>
                            {isCountryCompareMode && <span className="ml-2 text-xs font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">Pri</span>}
                          </div>
                          
                          {isCountryCompareMode && countryOverviewData2 && (
                             <div className="flex items-center pt-2 border-t border-slate-100">
                                <span className={`text-xl font-bold ml-7 ${
                                  (countryOverviewData2.matrix.reduce((sum, r) => sum + r.avgMobility, 0) / countryOverviewData2.totalRegions) < 0 
                                  ? 'text-red-500' : 'text-green-500'
                                }`}>
                                  {((countryOverviewData2.matrix.reduce((sum, r) => sum + r.avgMobility, 0) / countryOverviewData2.totalRegions) * 100).toFixed(1)}%
                                </span>
                                <span className="ml-2 text-xs font-semibold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">Cmp</span>
                             </div>
                          )}
                       </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                       <p className="text-sm text-slate-500 font-medium mb-1">Dataset Range</p>
                       <div className="flex items-center h-full">
                         <Calendar className="w-5 h-5 text-teal-500 mr-2" />
                         <span className="text-sm font-semibold text-slate-800">
                           {countryOverviewData1.trend[0]?.ds} — {countryOverviewData1.trend[countryOverviewData1.trend.length - 1]?.ds}
                         </span>
                       </div>
                    </div>
                  </div>

                  {/* Aggregated Charts */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                       <h3 className="text-md font-bold text-slate-800 mb-4">Mobility Trend</h3>
                       <div className="h-[300px]">
                         <ResponsiveContainer width="100%" height="100%">
                            {isCountryCompareMode ? (
                                <LineChart data={countryComparisonChartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="ds" hide />
                                    <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} fontSize={10} />
                                    <Tooltip formatter={(v: number, name) => [`${(v * 100).toFixed(2)}%`, name]} />
                                    <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
                                    <Legend />
                                    <Line type="monotone" dataKey="primary_mobility" name={countryViewCountry} stroke="#2563eb" strokeWidth={2} dot={false} />
                                    <Line type="monotone" dataKey="secondary_mobility" name={countryCompareType === 'country' ? countryViewCountry2 : countryViewRegion} stroke="#9333ea" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                                </LineChart>
                            ) : (
                                <AreaChart data={countryOverviewData1.trend}>
                                    <defs>
                                        <linearGradient id="colorAvgMob" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="ds" hide />
                                    <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} fontSize={10} />
                                    <Tooltip formatter={(v: number) => [`${(v * 100).toFixed(2)}%`, 'Avg Mobility']} />
                                    <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
                                    <Area type="monotone" dataKey="avgMobility" stroke="#3b82f6" fillOpacity={1} fill="url(#colorAvgMob)" />
                                </AreaChart>
                            )}
                         </ResponsiveContainer>
                       </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                       <h3 className="text-md font-bold text-slate-800 mb-4">Stay-at-Home Trend</h3>
                        <div className="h-[300px]">
                         <ResponsiveContainer width="100%" height="100%">
                            {isCountryCompareMode ? (
                                <LineChart data={countryComparisonChartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="ds" hide />
                                    <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} fontSize={10} />
                                    <Tooltip formatter={(v: number, name) => [`${(v * 100).toFixed(2)}%`, name]} />
                                    <Legend />
                                    <Line type="monotone" dataKey="primary_stay" name={countryViewCountry} stroke="#059669" strokeWidth={2} dot={false} />
                                    <Line type="monotone" dataKey="secondary_stay" name={countryCompareType === 'country' ? countryViewCountry2 : countryViewRegion} stroke="#d97706" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                                </LineChart>
                            ) : (
                                <AreaChart data={countryOverviewData1.trend}>
                                    <defs>
                                        <linearGradient id="colorAvgStay" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="ds" hide />
                                    <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} fontSize={10} />
                                    <Tooltip formatter={(v: number) => [`${(v * 100).toFixed(2)}%`, 'Avg Stay Home']} />
                                    <Area type="monotone" dataKey="avgStay" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorAvgStay)" />
                                </AreaChart>
                            )}
                         </ResponsiveContainer>
                       </div>
                    </div>
                  </div>

                  {/* Regional Matrix Table */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                     <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-4">
                           <h3 className="font-bold text-slate-800">Regional Performance Matrix</h3>
                           <span className="text-xs text-slate-400 bg-white px-2 py-1 border rounded">{sortedMatrix.length} regions</span>
                        </div>
                        
                        {isCountryCompareMode && (
                            <div className="flex bg-slate-200 p-1 rounded-lg">
                                <button 
                                    onClick={() => setMatrixTab('primary')}
                                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${matrixTab === 'primary' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    {countryViewCountry}
                                </button>
                                <button 
                                    onClick={() => setMatrixTab('secondary')}
                                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${matrixTab === 'secondary' ? 'bg-white shadow text-purple-700' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    {countryCompareType === 'country' ? countryViewCountry2 : countryViewRegion}
                                </button>
                            </div>
                        )}
                     </div>
                     <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                        <table className="w-full text-sm text-left text-slate-600">
                           <thead className="text-xs text-slate-700 uppercase bg-slate-50 sticky top-0 z-10 shadow-sm">
                              <tr>
                                 <th className="px-6 py-3 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('name')}>
                                    <div className="flex items-center">Region <ArrowUpDown className="w-3 h-3 ml-1" /></div>
                                 </th>
                                 <th className="px-6 py-3 cursor-pointer hover:bg-slate-100 text-right" onClick={() => handleSort('avgMobility')}>
                                    <div className="flex items-center justify-end">Avg Mobility <ArrowUpDown className="w-3 h-3 ml-1" /></div>
                                 </th>
                                 <th className="px-6 py-3 cursor-pointer hover:bg-slate-100 text-right" onClick={() => handleSort('minMobility')}>
                                    <div className="flex items-center justify-end">Min Mobility <ArrowUpDown className="w-3 h-3 ml-1" /></div>
                                 </th>
                                 <th className="px-6 py-3 cursor-pointer hover:bg-slate-100 text-right" onClick={() => handleSort('avgStay')}>
                                    <div className="flex items-center justify-end">Avg Stay Home <ArrowUpDown className="w-3 h-3 ml-1" /></div>
                                 </th>
                                  <th className="px-6 py-3 cursor-pointer hover:bg-slate-100 text-right" onClick={() => handleSort('maxStay')}>
                                    <div className="flex items-center justify-end">Max Stay Home <ArrowUpDown className="w-3 h-3 ml-1" /></div>
                                 </th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                              {sortedMatrix.map((region) => (
                                 <tr key={region.name} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-900">{region.name}</td>
                                    
                                    <td className="px-6 py-4 text-right">
                                       <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                          region.avgMobility < 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                                       }`}>
                                          {region.avgMobility > 0 ? '+' : ''}{(region.avgMobility * 100).toFixed(1)}%
                                       </span>
                                    </td>

                                     <td className="px-6 py-4 text-right text-slate-500">
                                       {(region.minMobility * 100).toFixed(1)}%
                                    </td>

                                    <td className="px-6 py-4 text-right">
                                       {(region.avgStay * 100).toFixed(1)}%
                                    </td>

                                    <td className="px-6 py-4 text-right font-semibold text-slate-700">
                                       {(region.maxStay * 100).toFixed(1)}%
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  </div>
                 </>
               )}
            </div>
          )}

          {/* ========================================================================================= */}
          {/* VIEW: REGION COMPARISON */}
          {/* ========================================================================================= */}
          {viewMode === 'region' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
              {/* Controls Container */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-4">
                  <h2 className="text-lg font-semibold text-slate-800 flex items-center">
                    <Filter className="w-5 h-5 mr-2 text-slate-500" />
                    Comparative Analysis
                  </h2>
                  
                  <button
                    onClick={() => setIsCompareMode(!isCompareMode)}
                    className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      isCompareMode 
                        ? 'bg-blue-100 text-blue-700 border border-blue-200 shadow-sm' 
                        : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    <GitCompare className="w-4 h-4 mr-2" />
                    {isCompareMode ? 'Disable Comparison' : 'Compare Data Sets'}
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Primary Selection Row */}
                  <div className="flex flex-col md:flex-row gap-4 items-start">
                    <div className="w-full md:w-auto md:min-w-[120px] pt-3">
                      <span className="flex items-center text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full w-max">
                        <span className="w-2 h-2 rounded-full bg-blue-500 mr-2"></span>
                        Primary
                      </span>
                    </div>
                    
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                          Country
                        </label>
                        <select
                          className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                          value={selectedCountry}
                          onChange={(e) => setSelectedCountry(e.target.value)}
                        >
                          {countries.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                          Region / Aggregate ({primaryRegions.length - 1} regions)
                        </label>
                        <select
                          className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                          value={selectedRegion}
                          onChange={(e) => setSelectedRegion(e.target.value)}
                        >
                          {primaryRegions.map((r) => (
                            <option key={r} value={r} className={r === WHOLE_COUNTRY_OPTION ? "font-bold text-blue-800 bg-blue-50" : ""}>{r}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Secondary Selection Row (Conditional) */}
                  {isCompareMode && (
                    <div className="flex flex-col md:flex-row gap-4 items-start border-t border-slate-100 pt-6 animate-in fade-in slide-in-from-top-2">
                      <div className="w-full md:w-auto md:min-w-[120px] pt-3">
                        <span className="flex items-center text-sm font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-full w-max">
                          <span className="w-2 h-2 rounded-full bg-orange-500 mr-2"></span>
                          Compare
                        </span>
                      </div>

                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                            Comparison Country
                          </label>
                          <select
                            className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block p-2.5"
                            value={selectedCountry2}
                            onChange={(e) => setSelectedCountry2(e.target.value)}
                          >
                            {countries.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                            Comparison Region / Aggregate ({secondaryRegions.length - 1} regions)
                          </label>
                          <select
                            className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block p-2.5"
                            value={selectedRegion2}
                            onChange={(e) => setSelectedRegion2(e.target.value)}
                          >
                            {secondaryRegions.map((r) => (
                              <option key={r} value={r} className={r === WHOLE_COUNTRY_OPTION ? "font-bold text-orange-800 bg-orange-50" : ""}>{r}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Stats Grid */}
              {stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-slate-500 text-sm font-medium">Avg Mobility Change</h3>
                      <Activity className="w-5 h-5 text-slate-400" />
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <div className="flex items-baseline justify-between">
                        <span className={`text-2xl font-bold ${parseFloat(stats.avgMobility) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {parseFloat(stats.avgMobility) > 0 ? '+' : ''}{stats.avgMobility}%
                        </span>
                        {isCompareMode && <span className="text-xs font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded">Pri</span>}
                      </div>
                      
                      {isCompareMode && stats2 && (
                        <div className="flex items-baseline justify-between pt-1 border-t border-slate-100">
                            <span className={`text-xl font-bold ${parseFloat(stats2.avgMobility) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {parseFloat(stats2.avgMobility) > 0 ? '+' : ''}{stats2.avgMobility}%
                            </span>
                            <span className="text-xs font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded">Cmp</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-slate-500 text-sm font-medium">Max Stay-at-Home</h3>
                      <Home className="w-5 h-5 text-indigo-500" />
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-bold text-slate-800">{stats.maxStayHome}%</span>
                        {isCompareMode && <span className="text-xs font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded">Pri</span>}
                      </div>
                      
                      {isCompareMode && stats2 && (
                        <div className="flex items-baseline justify-between pt-1 border-t border-slate-100">
                            <span className="text-xl font-bold text-slate-800">{stats2.maxStayHome}%</span>
                            <span className="text-xs font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded">Cmp</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-slate-500 text-sm font-medium">Date Range</h3>
                      <Calendar className="w-5 h-5 text-slate-400" />
                    </div>
                    <div className="flex flex-col">
                        <p className="text-sm font-semibold text-slate-800">{stats.start}</p>
                        <p className="text-sm font-semibold text-slate-800">to {stats.end}</p>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-slate-500 text-sm font-medium">Data Points</h3>
                      <Users className="w-5 h-5 text-teal-500" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-bold text-slate-800">{stats.count}</p>
                        <span className="text-sm text-slate-400">records</span>
                    </div>
                    {isCompareMode && stats2 && (
                        <p className="text-xs text-slate-400 mt-1">Comparison has {stats2.count} records</p>
                    )}
                  </div>
                </div>
              )}

              {/* Charts Area */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Chart 1: Mobility Change */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center justify-between">
                    <span>Relative Mobility Change</span>
                    <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-1 rounded">Baseline: {primaryData[0]?.baseline_type || 'MIXED'}</span>
                  </h3>
                  <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={comparisonChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis 
                            dataKey="ds" 
                            tick={{fontSize: 10}} 
                            tickMargin={10} 
                            stroke="#94a3b8"
                            minTickGap={30}
                        />
                        <YAxis 
                            tickFormatter={(val) => `${(val * 100).toFixed(0)}%`} 
                            tick={{fontSize: 10}}
                            stroke="#94a3b8"
                        />
                        <Tooltip 
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            formatter={(value: number, name: string) => {
                                if (value === null || value === undefined) return ['-', name];
                                return [`${(value * 100).toFixed(2)}%`, name];
                            }}
                            labelStyle={{ color: '#64748b' }}
                        />
                        <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
                        <Legend wrapperStyle={{paddingTop: '20px'}} />
                        
                        <Line 
                            type="monotone" 
                            dataKey="primary_mobility" 
                            name={selectedRegion === WHOLE_COUNTRY_OPTION ? `${selectedCountry} (Avg)` : selectedRegion} 
                            stroke="#3b82f6" 
                            strokeWidth={2} 
                            dot={false}
                            activeDot={{ r: 6 }} 
                        />
                        
                        {isCompareMode && (
                            <Line 
                                type="monotone" 
                                dataKey="secondary_mobility" 
                                name={selectedRegion2 === WHOLE_COUNTRY_OPTION ? `${selectedCountry2} (Avg)` : selectedRegion2} 
                                stroke="#f97316" 
                                strokeWidth={2} 
                                dot={false}
                                activeDot={{ r: 6 }} 
                                strokeDasharray="5 5"
                            />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 2: Stay at Home Ratio */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center justify-between">
                    <span>Stay-at-Home Ratio</span>
                    <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-1 rounded">Single Tile Users</span>
                  </h3>
                  <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={comparisonChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <defs>
                            <linearGradient id="colorRatio" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorRatio2" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f97316" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis 
                            dataKey="ds" 
                            tick={{fontSize: 10}} 
                            tickMargin={10} 
                            stroke="#94a3b8"
                            minTickGap={30}
                        />
                        <YAxis 
                            tickFormatter={(val) => `${(val * 100).toFixed(0)}%`} 
                            tick={{fontSize: 10}}
                            stroke="#94a3b8"
                            domain={[0, 'auto']}
                        />
                        <Tooltip 
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            formatter={(value: number, name: string) => {
                                if (value === null || value === undefined) return ['-', name];
                                return [`${(value * 100).toFixed(2)}%`, name];
                            }}
                            labelStyle={{ color: '#64748b' }}
                        />
                        <Legend wrapperStyle={{paddingTop: '20px'}} />
                        
                        <Area 
                            type="monotone" 
                            dataKey="primary_stay" 
                            name={selectedRegion === WHOLE_COUNTRY_OPTION ? `${selectedCountry} (Avg)` : selectedRegion} 
                            stroke="#3b82f6" 
                            fillOpacity={1} 
                            fill="url(#colorRatio)" 
                            strokeWidth={2}
                        />

                        {isCompareMode && (
                            <Area 
                                type="monotone" 
                                dataKey="secondary_stay" 
                                name={selectedRegion2 === WHOLE_COUNTRY_OPTION ? `${selectedCountry2} (Avg)` : selectedRegion2} 
                                stroke="#f97316" 
                                fillOpacity={1} 
                                fill="url(#colorRatio2)" 
                                strokeWidth={2}
                                strokeDasharray="5 5"
                            />
                        )}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="text-center text-slate-400 text-xs py-4">
             Data Source: Facebook Movement Range Maps.
          </div>

        </div>
      </main>
    </div>
  );
};

export default Dashboard;
