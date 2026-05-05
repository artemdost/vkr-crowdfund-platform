#!/usr/bin/env python3
"""Динамика глобального рынка краудфандинга + РФ (два графика на одном рисунке).

Источники данных:
- Глобальный рынок: IMARC Group, обновлённый отчёт 2025-2034
  (2025 = 20,4 млрд долл.; прогноз 2034 = 52,3 млрд долл.; CAGR 10,5% в 2026-2034).
- Российский рынок: Ассоциация ОИП, Эксперт РА, БДМ.
  2020-2024 факт (рост в 8 раз), 2025 факт (23,66 млрд руб., откат к уровню 2023).
"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from pathlib import Path

# Глобальный рынок (млрд долл.) - IMARC Group
# 2020-2025 факт, 2027-2034 прогноз (CAGR 10,5% за 2026-2034)
years_global = [2020, 2021, 2022, 2023, 2024, 2025, 2027, 2029, 2031, 2034]
volumes_global = [10.2, 11.3, 13.5, 15.8, 18.4, 20.4, 24.9, 30.4, 37.1, 52.3]

# Российский рынок (млрд руб.) - АОИП, Эксперт РА, БДМ
# 2020-2024 факт (восьмикратный рост), 2025 факт (откат)
years_ru = [2020, 2021, 2022, 2023, 2024, 2025]
volumes_ru = [7, 12, 20, 24, 53, 23.66]

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5.5), gridspec_kw={'width_ratios': [1.3, 1]})

# --- Левый график: глобальный рынок ---
fact_mask = [y <= 2025 for y in years_global]
forecast_mask = [y > 2025 for y in years_global]

years_fact = [y for y, m in zip(years_global, fact_mask) if m]
vols_fact = [v for v, m in zip(volumes_global, fact_mask) if m]
years_fore = [y for y, m in zip(years_global, forecast_mask) if m]
vols_fore = [v for v, m in zip(volumes_global, forecast_mask) if m]

bars1 = ax1.bar(years_fact, vols_fact, color='#5B9BD5', width=1.4,
                edgecolor='#3A7BBF', linewidth=1)
bars2 = ax1.bar(years_fore, vols_fore, color='#5B9BD5', width=1.4,
                edgecolor='#3A7BBF', linewidth=1, alpha=0.45, hatch='//')

for bar, vol in zip(list(bars1) + list(bars2), vols_fact + vols_fore):
    ax1.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.8,
             f'{vol}', ha='center', va='bottom', fontsize=9, fontweight='bold',
             fontfamily='serif')

ax1.set_xlabel('Год', fontsize=12, fontfamily='serif')
ax1.set_ylabel('Объём рынка, млрд долл.', fontsize=12, fontfamily='serif')
ax1.set_title('Глобальный рынок краудфандинга', fontsize=13, fontweight='bold',
              fontfamily='serif', pad=10)
ax1.set_xticks(years_global)
ax1.set_xticklabels([str(y) for y in years_global], fontsize=9, fontfamily='serif', rotation=45)
ax1.set_ylim(0, 60)
ax1.spines['top'].set_visible(False)
ax1.spines['right'].set_visible(False)
ax1.grid(axis='y', alpha=0.3)
ax1.tick_params(axis='y', labelsize=10)

# Аннотация CAGR
ax1.annotate('CAGR 10,5%\n(2026–2034)', xy=(2029, 30.4), xytext=(2024.5, 46),
             fontsize=10, fontweight='bold', color='#C0392B', fontfamily='serif',
             arrowprops=dict(arrowstyle='->', color='#C0392B', lw=1.5))

# Легенда
from matplotlib.patches import Patch
legend_elements = [
    Patch(facecolor='#5B9BD5', edgecolor='#3A7BBF', label='Факт'),
    Patch(facecolor='#5B9BD5', edgecolor='#3A7BBF', alpha=0.45, hatch='//', label='Прогноз IMARC'),
]
ax1.legend(handles=legend_elements, loc='upper left', fontsize=10,
           prop={'family': 'serif'}, frameon=True)

# --- Правый график: Россия ---
# Цвет последнего бара (2025) — другой, отражает откат
colors_ru = ['#E67E22'] * 5 + ['#A93226']
edges_ru = ['#D35400'] * 5 + ['#7B241C']

bars_ru = ax2.bar(years_ru, volumes_ru, color=colors_ru, width=0.6,
                  edgecolor=edges_ru, linewidth=1)

for bar, vol in zip(bars_ru, volumes_ru):
    label = f'{vol:g}'
    ax2.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 1,
             label, ha='center', va='bottom', fontsize=11, fontweight='bold',
             fontfamily='serif')

ax2.set_xlabel('Год', fontsize=12, fontfamily='serif')
ax2.set_ylabel('Объём рынка, млрд руб.', fontsize=12, fontfamily='serif')
ax2.set_title('Рынок РФ', fontsize=13, fontweight='bold',
              fontfamily='serif', pad=10)
ax2.set_xticks(years_ru)
ax2.set_xticklabels([str(y) for y in years_ru], fontsize=10, fontfamily='serif')
ax2.set_ylim(0, 70)
ax2.spines['top'].set_visible(False)
ax2.spines['right'].set_visible(False)
ax2.grid(axis='y', alpha=0.3)
ax2.tick_params(axis='y', labelsize=10)

ax2.annotate('×8 за 4 года', xy=(2024, 53), xytext=(2020.4, 63),
             fontsize=11, fontweight='bold', color='#27AE60', fontfamily='serif',
             arrowprops=dict(arrowstyle='->', color='#27AE60', lw=1.5))

ax2.annotate('Откат к уровню\n2023 года', xy=(2025, 23.66), xytext=(2022.6, 38),
             fontsize=10, fontweight='bold', color='#A93226', fontfamily='serif',
             arrowprops=dict(arrowstyle='->', color='#A93226', lw=1.5))

# План ЦБ — горизонтальная отсылка под графиком
ax2.text(0.5, -0.22,
         'План Банка России: 165,3 млрд руб. суммарно за 2025–2027 годы',
         transform=ax2.transAxes, ha='center', va='top',
         fontsize=9, style='italic', color='#34495E', fontfamily='serif')

plt.tight_layout()
out = Path(__file__).parent / 'market_chart.png'
plt.savefig(out, dpi=200, bbox_inches='tight', facecolor='white')
print(f'OK: {out}')
