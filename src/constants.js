import { SCHEMA_VERSION } from './schema.js';

export { SCHEMA_VERSION };

export const STATUS = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  NO_RESULT: 'NO_RESULT',
  NO_RESULT_REPEATED: 'NO_RESULT_REPEATED',
  INCONCLUSIVE: 'INCONCLUSIVE',
  NEEDS_USER: 'NEEDS_USER',
  ERROR: 'ERROR',
  FILTERED: 'FILTERED'
});

export const CONFIDENCE = Object.freeze({ CONFIRMED:'CONFIRMED', LIKELY:'LIKELY', AMBIGUOUS:'AMBIGUOUS', INCONCLUSIVE:'INCONCLUSIVE' });

export const DEFAULT_SETTINGS = Object.freeze({
  retriesPerQuery: 3,
  minDelaySeconds: 8,
  maxDelaySeconds: 16,
  maxBackoffSeconds: 120,
  resultWaitSeconds: 35,
  autoSync: false,
  smartOrder: true,
  stopOnFirstAvailable: false,
  sheetsWebAppUrl: '',
  sheetsToken: '',
  providerPolicies: {},
  mmSearchPageUrl: 'https://www.miles-and-more.com/be/en/spend/flights/flight-award.html',
  lufthansaSearchPageUrl: 'https://www.lufthansa.com/be/en/homepage',
  brusselsAirlinesSearchPageUrl: 'https://www.brusselsairlines.com/be/en/book-a-flight/flight-search',
  notificationsEnabled: false,
  mmPinnedOverlay: false
});

export const RESULT_COLUMNS = [
  'schema_version','result_id','query_id','query_key','run_id','adapter','parser_version','origin','destination','outbound_date','return_origin','return_destination','return_date','trip_type','adults','cabin_requested',
  'status','confidence','status_detail','mileage_price','mileage_scope','cash_price','cash_total_per_person','currency','price_scope','price_kind','price_comparable','fees','fees_currency','fees_scope','fees_included','itinerary_key','itinerary_stage','departure_time','arrival_time','observed_cabin','operating_carrier','marketing_carrier',
  'flight_numbers','connections','connection_airports','duration_minutes','mixed_cabin','lowest_cabin','requested_cabin_share','seats','constraint_passes','constraint_reasons','segments_json',
  'source_url','found_at','checked_at','attempt','raw_excerpt','sync_status','sync_error'
];

export const SUMMARY_COLUMNS = [
  'schema_version','summary_id','query_id','query_key','run_id','adapter','origin','destination','outbound_date','return_origin','return_destination','return_date','trip_type','adults','cabin_requested',
  'final_status','confidence','attempts_recorded','available_attempts','best_mileage_price','best_cash_price','currency','best_fees','fees_currency','cash_price_basis',
  'flight_numbers','connection_airports','minimum_duration_minutes','first_available_at','last_checked_at','status_detail','sync_status','sync_error'
];

export const RUN_COLUMNS = ['schema_version','run_id','started_at','ended_at','status','total_queries','completed_queries','search_definition_json','settings_snapshot_json'];
export const CURRENT_BEST_COLUMNS = ['schema_version','query_key','summary_id','run_id','adapter','origin','destination','outbound_date','return_origin','return_destination','return_date','trip_type','cabin_requested','final_status','best_mileage_price','best_cash_price','currency','best_fees','fees_currency','cash_price_basis','last_checked_at'];
