import pandas as pd
import os

CSV_FILE = 'c:/Users/Administrator/Documents/3Professores/my-app/front-end/assets/cobranca_assessorias.csv'
df = pd.read_csv(CSV_FILE)

ids = ['CONTR_2026_09895', 'CONTR_2026_09896', 'CONTR_2026_09898', 'CONTR_2026_09899', 'CONTR_2026_09897']
sub = df[df['ID_Contrato'].isin(ids)]
print(sub[['ID_Contrato', 'Regiao_Cliente', 'Valor_Inadimplente_Inicial', 'Dias_Em_Atraso_Inicial', 'Score_Interno_Risco', 'Status_Cobranca']].to_string())
