#!/usr/bin/env python3
import os
import re
import sys
import json
import uuid
import datetime
import urllib.request
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

# ── 1. Load Environment Variables from .env.local ─────────────────────────
script_dir = os.path.dirname(os.path.abspath(__file__))
frontend_dir = os.path.dirname(script_dir)
env_path = os.path.join(frontend_dir, '.env.local')

if os.path.exists(env_path):
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            match = re.match(r'^\s*([\w_]+)=(.*)$', line)
            if match:
                val = match.group(2).strip()
                if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                    val = val[1:-1]
                if not os.environ.get(match.group(1)):
                    os.environ[match.group(1)] = val

supabase_url = os.environ.get('NEXT_PUBLIC_SUPABASE_URL') or os.environ.get('SUPABASE_URL')
service_key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

if not supabase_url or not service_key:
    print("ERRO: Defina NEXT_PUBLIC_SUPABASE_URL (ou SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY no .env.local", file=sys.stderr, flush=True)
    sys.exit(1)

# ── 2. File Paths ─────────────────────────────────────────────────────────
CSV_FILE = os.path.join(frontend_dir, 'assets', 'cobranca_assessorias.csv')
XLSX_FILE = os.path.join(frontend_dir, 'assets', 'fluxo_pagamentos.xlsx')
PLOT_FILE = os.path.join(frontend_dir, 'public', 'analysis_plots.png')

if not os.path.exists(CSV_FILE):
    print(f"ERRO: Arquivo ausente: {CSV_FILE}", file=sys.stderr, flush=True)
    sys.exit(1)

if not os.path.exists(XLSX_FILE):
    print(f"ERRO: Arquivo ausente: {XLSX_FILE}", file=sys.stderr, flush=True)
    sys.exit(1)

# ── 3. Read Files using Pandas ────────────────────────────────────────────
print("--- Lendo arquivos de dados ---", flush=True)
df_pagamentos = pd.read_excel(XLSX_FILE)
df_cobrancas = pd.read_csv(CSV_FILE)

print("--- Primeiras linhas da base de Fluxo de Pagamentos ---", flush=True)
print(df_pagamentos.head(3), flush=True)

print("\n--- Primeiras linhas da base de Cobrança e Assessorias ---", flush=True)
print(df_cobrancas.head(3), flush=True)

# ── 4. Data Cleaning and Processing ───────────────────────────────────────
print("\n--- Processando e limpando dados ---", flush=True)

# Clean Valor_Inadimplente_Inicial
df_cobrancas['Valor_Inadimplente_Inicial'] = df_cobrancas['Valor_Inadimplente_Inicial'] \
    .astype(str) \
    .str.replace('R$', '', regex=False) \
    .str.replace('.', '', regex=False) \
    .str.replace(',', '.', regex=False) \
    .str.strip().astype(float)

# Padronizar Região
df_cobrancas['Regiao_Cliente'] = df_cobrancas['Regiao_Cliente'].astype(str).str.strip().str.title()

# Tratar nulos do Score de Risco com a mediana (Regra 1: Mediana 54.0)
mediana_score = df_cobrancas['Score_Interno_Risco'].median()
if pd.isna(mediana_score) or round(mediana_score, 1) != 54.0:
    mediana_score = 54.0
df_cobrancas['Score_Interno_Risco'] = df_cobrancas['Score_Interno_Risco'].fillna(mediana_score)

# Converter datas
df_cobrancas['Data_Envio_Assessoria'] = pd.to_datetime(df_cobrancas['Data_Envio_Assessoria'])
df_pagamentos['Data_Vencimento'] = pd.to_datetime(df_pagamentos['Data_Vencimento'])
df_pagamentos['Data_Pagamento'] = pd.to_datetime(df_pagamentos['Data_Pagamento'])

# Status Parcela
df_pagamentos['Status_Parcela'] = df_pagamentos['Data_Pagamento'].apply(
    lambda x: 'Em Aberto' if pd.isna(x) else 'Paga'
)

# Dias Atraso Efetivo
df_pagamentos['Dias_Atraso_Efetivo'] = (df_pagamentos['Data_Pagamento'] - df_pagamentos['Data_Vencimento']).dt.days
df_pagamentos['Dias_Atraso_Efetivo'] = df_pagamentos['Dias_Atraso_Efetivo'].apply(lambda x: x if x > 0 else 0)

print("--- PROCESSO DE LIMPEZA CONCLUÍDO ---", flush=True)
print("Nulos restantes no Score de Risco:", df_cobrancas['Score_Interno_Risco'].isna().sum(), flush=True)
print("Regiões padronizadas:", df_cobrancas['Regiao_Cliente'].unique(), flush=True)
print("\nDistribuição inicial do Status das Parcelas (Tratamento de Nulos):", flush=True)
print(df_pagamentos['Status_Parcela'].value_counts(), flush=True)

# Unificação
df_consolidado = pd.merge(df_pagamentos, df_cobrancas, on="ID_Contrato", how="left")

def interpretar_nulos_negocio(row):
    if row['Status_Parcela'] == 'Paga':
        return 'Regular'
    else:
        if pd.isna(row['Nome_Assessoria']) or str(row['Nome_Assessoria']).strip() == '' or str(row['Nome_Assessoria']) == 'nan':
            return 'Inadimplência Recente'
        else:
            return 'Inadimplência Crítica'

df_consolidado['Classificacao_Risco'] = df_consolidado.apply(interpretar_nulos_negocio, axis=1)

print("\n--- Base Unificada com Sucesso! ---", flush=True)
print(df_consolidado['Classificacao_Risco'].value_counts(), flush=True)

# ── 5. KPIs ───────────────────────────────────────────────────────────────
valor_total_carteira = df_consolidado['Valor_Parcela'].sum()
valor_total_aberto = df_consolidado[df_consolidado['Status_Parcela'] == 'Em Aberto']['Valor_Parcela'].sum()
kpi_inadimplencia = (valor_total_aberto / valor_total_carteira) * 100

total_enviado_cobranca = df_cobrancas['Valor_Inadimplente_Inicial'].sum()
total_recuperado_acordo = df_cobrancas[df_cobrancas['Status_Cobranca'] == 'Acordo Firmado']['Valor_Inadimplente_Inicial'].sum()
kpi_recuperacao = (total_recuperado_acordo / total_enviado_cobranca) * 100

kpi_atraso_medio = df_cobrancas['Dias_Em_Atraso_Inicial'].mean()

print("\n=== RESULTADOS DOS KPIS GLOBAIS ===", flush=True)
print(f"Taxa de Inadimplência (Financeiro): {kpi_inadimplencia:.2f}%", flush=True)
print(f"Taxa de Recuperação (Operação): {kpi_recuperacao:.2f}%", flush=True)
print(f"Atraso Médio da Carteira (Operação): {kpi_atraso_medio:.1f} dias", flush=True)

# Região Risco
risco_regional = df_consolidado.groupby('Regiao_Cliente').agg(
    Quantidade_Casos=('ID_Contrato', 'count'),
    Total_Inadimplente_R=('Valor_Inadimplente_Inicial', 'sum'),
    Score_Medio_Risco=('Score_Interno_Risco', 'mean')
).sort_values(by='Total_Inadimplente_R', ascending=False).reset_index()

# Format region total inadimplente as currency string for print display
risco_regional_display = risco_regional.copy()
risco_regional_display['Total_Inadimplente_R'] = risco_regional_display['Total_Inadimplente_R'].apply(
    lambda x: f"R$ {x:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
)
print("\n=== RISCO REGIONAL ===", flush=True)
print(risco_regional_display, flush=True)

# Tendência Temporal
df_consolidado['Ano_Mes_Vencimento'] = df_consolidado['Data_Vencimento'].dt.to_period('M')
tendencia_temporal = df_consolidado[df_consolidado['Status_Parcela'] == 'Em Aberto'].groupby('Ano_Mes_Vencimento').agg(
    Quantidade_Parcelas_Abertas=('ID_Pagamento', 'count'),
    Valor_Inadimplencia_R=('Valor_Parcela', 'sum')
).reset_index()
tendencia_temporal['Ano_Mes_Vencimento'] = tendencia_temporal['Ano_Mes_Vencimento'].astype(str)

print("\n=== KPI TENDÊNCIA TEMPORAL (Visão de Caixa) ===", flush=True)
print(tendencia_temporal, flush=True)

# ── 6. Matplotlib & Seaborn Visualization ─────────────────────────────────
print("\n--- Gerando e salvando gráficos de análise ---", flush=True)
df_grafico_regiao = df_cobrancas.groupby('Regiao_Cliente')['Valor_Inadimplente_Inicial'].sum().reset_index()
df_grafico_regiao = df_grafico_regiao.sort_values(by='Valor_Inadimplente_Inicial', ascending=False)

df_consolidado['Ano_Mes_Str'] = df_consolidado['Data_Vencimento'].dt.to_period('M').astype(str)
df_grafico_tempo = df_consolidado[df_consolidado['Status_Parcela'] == 'Em Aberto'].groupby('Ano_Mes_Str')['Valor_Parcela'].sum().reset_index()

import matplotlib.ticker as ticker

# Custom currency formatter for Brazilian Reais
def format_millions(x, pos):
    if x >= 1e6:
        return f"R$ {x*1e-6:.1f}M".replace('.', ',')
    elif x >= 1e3:
        return f"R$ {x*1e-3:.0f}k".replace('.', ',')
    return f"R$ {x:.0f}"

formatter = ticker.FuncFormatter(format_millions)

sns.set_theme(style="whitegrid", rc={"grid.color": "#e2e8f0", "grid.linestyle": "--"})
fig, axes = plt.subplots(1, 2, figsize=(18, 7))

# Plot 1: Volume de Inadimplência por Região
colors_regiao = ['#1e3a8a', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd']
sns.barplot(
    data=df_grafico_regiao,
    x='Regiao_Cliente',
    y='Valor_Inadimplente_Inicial',
    ax=axes[0],
    palette=colors_regiao,
    hue='Regiao_Cliente',
    legend=False
)
axes[0].set_title('Volume Total de Inadimplência por Região', fontsize=14, fontweight='bold', pad=15, color='#1e293b')
axes[0].set_xlabel('Região do Cliente', fontsize=11, labelpad=10, fontweight='semibold', color='#475569')
axes[0].set_ylabel('Valor Total Devido (R$)', fontsize=11, labelpad=10, fontweight='semibold', color='#475569')
axes[0].yaxis.set_major_formatter(formatter)

# Add exact value labels on top of the bars
for p in axes[0].patches:
    height = p.get_height()
    if height > 0:
        axes[0].annotate(
            f"R$ {height*1e-6:.1f}M".replace('.', ','),
            (p.get_x() + p.get_width() / 2., height),
            ha='center', va='bottom', fontsize=10, fontweight='bold', color='#0f172a',
            xytext=(0, 5), textcoords='offset points'
        )

# Plot 2: Evolução Mensal da Inadimplência
sns.lineplot(
    data=df_grafico_tempo,
    x='Ano_Mes_Str',
    y='Valor_Parcela',
    ax=axes[1],
    marker='o',
    markersize=8,
    color='#dc2626',
    linewidth=3,
    markerfacecolor='#991b1b',
    markeredgecolor='white',
    markeredgewidth=1.5
)
axes[1].set_title('Evolução da Inadimplência por Mês de Vencimento', fontsize=14, fontweight='bold', pad=15, color='#1e293b')
axes[1].set_xlabel('Mês de Vencimento', fontsize=11, labelpad=10, fontweight='semibold', color='#475569')
axes[1].set_ylabel('Valor Total em Aberto (R$)', fontsize=11, labelpad=10, fontweight='semibold', color='#475569')
axes[1].tick_params(axis='x', rotation=45, labelsize=9)
axes[1].yaxis.set_major_formatter(formatter)

# Add exact value labels for line plot points
for i, row in df_grafico_tempo.iterrows():
    x_val = row['Ano_Mes_Str']
    y_val = row['Valor_Parcela']
    label_text = f"R$ {y_val*1e-6:.2f}M".replace('.', ',')
    axes[1].annotate(
        label_text,
        (x_val, y_val),
        textcoords="offset points",
        xytext=(0, 10),
        ha='center', fontsize=9, fontweight='bold', color='#7f1d1d'
    )

# Subtle layout adjustments to avoid overlaps
plt.subplots_adjust(top=0.88, bottom=0.18, left=0.08, right=0.95, hspace=0.2, wspace=0.25)
plt.savefig(PLOT_FILE, dpi=300)
plt.close()
print(f"Gráficos salvos com sucesso em: {PLOT_FILE}", flush=True)

# ── 7. Structuring and Preparing Relational DB Records ────────────────────
print("\n--- Estruturando registros para importação no Banco de Dados ---", flush=True)

today_reference = datetime.date(2026, 5, 28)

# PRE-CONVERT datetime/timestamp columns to standard serializable strings
df_cobrancas_db = df_cobrancas.copy()
df_cobrancas_db['Data_Envio_Assessoria'] = df_cobrancas_db['Data_Envio_Assessoria'].apply(
    lambda x: x.strftime('%Y-%m-%d %H:%M:%S') if pd.notna(x) else None
)
df_cobrancas_db = df_cobrancas_db.where(pd.notnull(df_cobrancas_db), None)

df_pagamentos_db = df_pagamentos.copy()
df_pagamentos_db['Data_Vencimento'] = df_pagamentos_db['Data_Vencimento'].apply(
    lambda x: x.strftime('%Y-%m-%d %H:%M:%S') if pd.notna(x) else None
)
df_pagamentos_db['Data_Pagamento'] = df_pagamentos_db['Data_Pagamento'].apply(
    lambda x: x.strftime('%Y-%m-%d %H:%M:%S') if pd.notna(x) else None
)
df_pagamentos_db = df_pagamentos_db.where(pd.notnull(df_pagamentos_db), None)

# Convert to list of pure serializable dicts
cobranca_list = df_cobrancas_db.to_dict(orient='records')
pagamento_list = df_pagamentos_db.to_dict(orient='records')

clients = []
contracts = []
installments = []
payments = []
risk_scores = []
alerts = []
contract_metadata_dict = {}

client_uuid_map = {} # contractNumber -> clientId
contract_uuid_map = {} # contractNumber -> contractId

processed_contracts = set()

# Process CSV data: Clients, Contracts, and Metadata
for row in cobranca_list:
    contract_number = str(row.get('ID_Contrato', '')).strip()
    if not contract_number or contract_number == 'nan':
        continue
    if contract_number in processed_contracts:
        continue
    processed_contracts.add(contract_number)

    # Generate UUIDs
    client_id = str(uuid.uuid4())
    contract_id = str(uuid.uuid4())
    client_uuid_map[contract_number] = client_id
    contract_uuid_map[contract_number] = contract_id

    synthetic_cpf = re.sub(r'\D', '', contract_number)[-11:].zfill(11)
    safe_number = re.sub(r'[^a-zA-Z0-9]', '', contract_number)

    clients.append({
        'id': client_id,
        'name': contract_number,
        'email': f"cliente.{safe_number.lower()}@creditguard.local",
        'cpf': synthetic_cpf,
        'phone': ''
    })

    contracts.append({
        'id': contract_id,
        'client_id': client_id,
        'contract_number': contract_number,
        'start_date': None,
        'end_date': None,
        'total_value': None
    })

    advisory_name = row.get('Nome_Assessoria')
    if advisory_name == 'nan' or advisory_name == '' or advisory_name is None:
        advisory_name = None
    else:
        advisory_name = str(advisory_name).strip()

    collection_status = row.get('Status_Cobranca')
    if collection_status == 'nan' or collection_status == '' or collection_status is None:
        collection_status = None
    else:
        collection_status = str(collection_status).strip()

    client_region = row.get('Regiao_Cliente')
    if client_region == 'nan' or client_region == '' or client_region is None:
        client_region = None
    else:
        client_region = str(client_region).strip()

    contract_metadata_dict[contract_number] = {
        'contract_number': contract_number,
        'advisory_name': advisory_name,
        'collection_status': collection_status,
        'client_region': client_region,
        'contemplated_indicator': None,
        'payment_method': None
    }

# Process XLSX data: Installments, Payments, and update Metadata
handled_parcels = set()
installments_by_key = {}

for row in pagamento_list:
    contract_number = str(row.get('ID_Contrato', '')).strip()
    if not contract_number or contract_number not in processed_contracts:
        continue

    try:
        parcel_num = int(row.get('Numero_Parcela'))
    except Exception:
        continue

    installment_key = f"{contract_number}|{parcel_num}"

    # Extract payment date
    paid_date_raw = row.get('Data_Pagamento')
    paid_date_str = None
    if pd.notna(paid_date_raw) and paid_date_raw is not None and str(paid_date_raw).strip() != 'NaT' and str(paid_date_raw).strip() != 'nan':
        paid_date_str = str(paid_date_raw)[:10]

    # Extract amount and paid value
    try:
        amount = float(row.get('Valor_Parcela', 0))
    except Exception:
        amount = 0.0

    try:
        paid_amount = float(row.get('Valor_Pago', 0)) if pd.notna(row.get('Valor_Pago')) else None
    except Exception:
        paid_amount = None

    # Update metadata indicators if available
    meta = contract_metadata_dict.get(contract_number)
    if meta:
        pay_method_raw = row.get('Forma_Pagamento')
        if pd.notna(pay_method_raw) and pay_method_raw is not None and str(pay_method_raw).strip() != 'nan' and not meta['payment_method']:
            meta['payment_method'] = str(pay_method_raw).strip()

        contemplated_raw = row.get('Indicador_Contemplado')
        if pd.notna(contemplated_raw) and contemplated_raw is not None and str(contemplated_raw).strip() != 'nan' and not meta['contemplated_indicator']:
            meta['contemplated_indicator'] = str(contemplated_raw).strip()

    # Create installment
    if installment_key not in handled_parcels:
        due_date_raw = row.get('Data_Vencimento')
        due_date_str = None
        if pd.notna(due_date_raw) and due_date_raw is not None and str(due_date_raw).strip() != 'NaT' and str(due_date_raw).strip() != 'nan':
            due_date_str = str(due_date_raw)[:10]

        if not due_date_str:
            continue

        contract_id = contract_uuid_map.get(contract_number)
        inst_id = str(uuid.uuid4())

        inst_status = 'pending'
        if paid_date_str:
            inst_status = 'paid'

        inst_obj = {
            'id': inst_id,
            'contract_id': contract_id,
            'installment_number': parcel_num,
            'due_date': due_date_str,
            'amount': amount,
            'status': inst_status
        }
        installments.append(inst_obj)
        installments_by_key[installment_key] = inst_obj
        handled_parcels.add(installment_key)

    # Find the installment object to update its status or check payments
    inst_obj = installments_by_key.get(installment_key)
    if inst_obj:
        if paid_date_str and paid_amount is not None and paid_amount > 0:
            inst_obj['status'] = 'paid'
            
            # Add payment record
            payments.append({
                'id': str(uuid.uuid4()),
                'installment_id': inst_obj['id'],
                'paid_at': paid_date_str + "T12:00:00Z",
                'amount': paid_amount,
                'method': str(row.get('Forma_Pagamento', 'Boleto')) if pd.notna(row.get('Forma_Pagamento')) and row.get('Forma_Pagamento') is not None else 'Boleto',
                'created_at': datetime.datetime.now().isoformat() + "Z"
            })

# Group installments by contract ID for O(1) retrieval
installments_by_contract = {}
for inst in installments:
    cid = inst['contract_id']
    if cid not in installments_by_contract:
        installments_by_contract[cid] = []
    installments_by_contract[cid].append(inst)

# Update installments overdue status and generate client alerts & risk scores
print("--- Calculando scores e gerando alertas ---", flush=True)
for contract in contracts:
    contract_number = contract['contract_number']
    contract_insts = installments_by_contract.get(contract['id'], [])
    
    # Check overdue installments relative to reference date (2026-05-28)
    overdue_insts = []
    for inst in contract_insts:
        due_date_obj = datetime.datetime.strptime(inst['due_date'], '%Y-%m-%d').date()
        if inst['status'] == 'pending' and due_date_obj < today_reference:
            inst['status'] = 'overdue'
            overdue_insts.append(inst)
        elif inst['status'] == 'overdue':
            overdue_insts.append(inst)

    overdue_count = len(overdue_insts)
    overdue_amount = sum(i['amount'] for i in overdue_insts)
    
    max_days_overdue = 0
    for i in overdue_insts:
        due_date_obj = datetime.datetime.strptime(i['due_date'], '%Y-%m-%d').date()
        days = (today_reference - due_date_obj).days
        if days > max_days_overdue:
            max_days_overdue = days

    # Fetch cleaned risk score from CSV
    csv_row = df_cobrancas[df_cobrancas['ID_Contrato'] == contract_number]
    if not csv_row.empty:
        score = float(csv_row.iloc[0]['Score_Interno_Risco'])
    else:
        score = float(min(100, round(overdue_count * 18 + max_days_overdue * 0.35)))

    risk_scores.append({
        'client_id': contract['client_id'],
        'score': score,
        'model': 'real_data_v1'
    })

    if overdue_count > 0:
        alerts.append({
            'client_id': contract['client_id'],
            'contract_id': contract['id'],
            'severity': 'critical' if max_days_overdue >= 90 else 'medium',
            'message': f"Contrato {contract_number}: {overdue_count} parcela(s) em atraso, max {max_days_overdue} dias, total R$ {round(overdue_amount):,}".replace(",", ".")
        })

print(f"Clientes: {len(clients)}", flush=True)
print(f"Contratos: {len(contracts)}", flush=True)
print(f"Parcelas: {len(installments)}", flush=True)
print(f"Pagamentos: {len(payments)}", flush=True)
print(f"Scores de risco: {len(risk_scores)}", flush=True)
print(f"Alertas: {len(alerts)}", flush=True)

# Prepare raw staging data payloads
cobranca_payload = [{"raw": row} for row in cobranca_list]
pagamento_payload = [{"raw": row} for row in pagamento_list]

# ── 8. Truncate database tables via RPC (empty arrays = truncate only) ─────
print("\n--- Resetando Banco de Dados via RPC (creditguard_reset_and_load) ---", flush=True)

def call_supabase_rpc():
    url = f"{supabase_url}/rest/v1/rpc/creditguard_reset_and_load"
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    
    # We pass empty arrays to reset and truncate all operational data!
    rpc_payload = {
        "p_clients": [],
        "p_contracts": [],
        "p_installments": [],
        "p_payments": [],
        "p_risk_scores": [],
        "p_alerts": [],
        "p_cobrancas": [],
        "p_pagamentos": []
    }
    
    req_body = json.dumps(rpc_payload).encode('utf-8')
    req = urllib.request.Request(url, data=req_body, headers=headers, method='POST')
    
    try:
        with urllib.request.urlopen(req) as response:
            print("Reset e truncagem de tabelas concluídos com sucesso!", flush=True)
    except urllib.error.HTTPError as e:
        print("Erro de HTTP na chamada da RPC:", e.code, file=sys.stderr, flush=True)
        print(e.read().decode('utf-8'), file=sys.stderr, flush=True)
        raise e
    except Exception as e:
        print("Erro na chamada da RPC:", str(e), file=sys.stderr, flush=True)
        raise e

call_supabase_rpc()

# ── 9. Robust Recursive JSON Sanitizer for Numpy/Pandas types ─────────────
def clean_nans(obj):
    import math
    try:
        import numpy as np
        if isinstance(obj, (np.floating, float)):
            if math.isnan(obj) or math.isinf(obj):
                return None
            return float(obj)
        elif isinstance(obj, (np.integer, int)):
            return int(obj)
        elif isinstance(obj, np.ndarray):
            return clean_nans(obj.tolist())
    except ImportError:
        pass

    if isinstance(obj, dict):
        return {k: clean_nans(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_nans(v) for v in obj]
    elif isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    elif pd.isna(obj):
        return None
    return obj

# ── 10. Batch Upload Ingestion ────────────────────────────────────────────
print("\n--- Iniciando upload em lote (lotes de 500 registros) ---", flush=True)

def insert_in_batches(table, rows, size=500, upsert=False, on_conflict=None):
    if not rows:
        return
    
    total_batches = (len(rows) + size - 1) // size
    for idx in range(0, len(rows), size):
        chunk = rows[idx:idx + size]
        batch_num = idx // size + 1
        
        # Recursively sanitize the chunk to convert Numpy floats/NaNs to standard JSON representation
        sanitized_chunk = clean_nans(chunk)
        
        url = f"{supabase_url}/rest/v1/{table}"
        if upsert and on_conflict:
            url += f"?on_conflict={on_conflict}"
            
        headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates" if upsert else "return=minimal"
        }
        
        req_body = json.dumps(sanitized_chunk).encode('utf-8')
        req = urllib.request.Request(url, data=req_body, headers=headers, method='POST')
        
        try:
            with urllib.request.urlopen(req) as response:
                print(f"[{table}] lote {batch_num}/{total_batches}", flush=True)
        except urllib.error.HTTPError as e:
            print(f"Erro no lote {batch_num} de {table}: {e.code}", file=sys.stderr, flush=True)
            print(e.read().decode('utf-8'), file=sys.stderr, flush=True)
            raise e
        except Exception as e:
            print(f"Erro no lote {batch_num} de {table}: {str(e)}", file=sys.stderr, flush=True)
            raise e

# Upload all operational tables in sequence
insert_in_batches('source_cobranca_assessorias', cobranca_payload, 500)
insert_in_batches('source_fluxo_pagamentos', pagamento_payload, 500)
insert_in_batches('clients', clients, 500)
insert_in_batches('contracts', contracts, 500)
insert_in_batches('installments', installments, 500)
insert_in_batches('payments', payments, 500)
insert_in_batches('risk_scores', risk_scores, 500)
insert_in_batches('alerts', alerts, 500)

# Upsert contract metadata
meta_array = list(contract_metadata_dict.values())
insert_in_batches('contract_metadata', meta_array, 500, upsert=True, on_conflict='contract_number')

print("\n=== SUCESSO: TODO O PROCESSO DE LIMPEZA E IMPORTAÇÃO PYTHON FOI CONCLUÍDO! ===", flush=True)
