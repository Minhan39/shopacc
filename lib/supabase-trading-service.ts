type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
  table: string;
};

type TradingIncomeInput = {
  firebaseId: string;
  amount: number;
  note: string | null;
  date: string;
};

let configInstance: SupabaseConfig | null | undefined;

function getSupabaseConfig() {
  if (configInstance !== undefined) {
    return configInstance;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!url || !serviceRoleKey) {
    configInstance = null;
    return configInstance;
  }

  configInstance = {
    url: url.replace(/\/$/, ''),
    serviceRoleKey,
    table: process.env.SUPABASE_TRADING_TABLE || 'incomes',
  };

  return configInstance;
}

function toSupabaseErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown Supabase trading error';
}

async function parseSupabaseResponse(response: Response) {
  if (response.ok) {
    return;
  }

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  const message =
    typeof payload === 'object' && payload && 'message' in payload && typeof payload.message === 'string'
      ? payload.message
      : typeof payload === 'string'
        ? payload
        : 'Supabase trading insert failed';

  throw new Error(message);
}

export class SupabaseTradingService {
  async addTradingIncome(input: TradingIncomeInput) {
    const config = getSupabaseConfig();
    if (!config) return;

    const date = new Date(input.date);
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
    const incomeTimestamp = safeDate.toISOString();

    const response = await fetch(`${config.url}/rest/v1/${config.table}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        firebase_id: input.firebaseId,
        user_id: process.env.SUPABASE_TRADING_USER_ID || 'EMPTY',
        type: 'trading',
        amount: input.amount,
        note: input.note || '',
        date: incomeTimestamp,
        month: safeDate.getMonth() + 1,
        year: safeDate.getFullYear(),
        created_at: incomeTimestamp,
      }),
    });

    await parseSupabaseResponse(response);
  }
}

const supabaseTradingService = new SupabaseTradingService();

export async function addTradingIncomeToSupabase(input: TradingIncomeInput) {
  try {
    await supabaseTradingService.addTradingIncome(input);
  } catch (error) {
    console.warn(`[supabase-trading] ${toSupabaseErrorMessage(error)}`);
  }
}
