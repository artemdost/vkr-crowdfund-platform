#!/usr/bin/env python3
"""Динамика глобального рынка краудфандинга + РФ (два графика на одном рисунке)."""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
from pathlib import Path

# Глобальный рынок (млрд долл.) - IMARC Group
# 2020-2024 факт, 2025-2033 прогноз (CAGR 10.8%)
years_global = [2020, 2021, 2022, 2023, 2024, 2025, 2027, 2029, 2031, 2033]
volumes_global = [10.2, 11.3, 13.5, 15.8, 18.4, 20.4, 25.1, 30.8, 37.8, 46.4]

# Российский рынок (млрд руб.) - Ассоциация ОИП / BusinesStat
years_ru = [2020, 2021, 2022, 2023, 2024]
volumes_ru = [7, 12, 20, 40, 53]

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5.5), gridspec_kw={'width_ratios': [1.3, 1]})

# --- Левый график: глобальный рынок ---
# Факт (2020-2024) - сплошные столбцы
fact_mask = [y <= 2024 for y in years_global]
forecast_mask = [y > 2024 for y in years_global]

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
ax1.set_ylim(0, 55)
ax1.spines['top'].set_visible(False)
ax1.spines['right'].set_visible(False)
ax1.grid(axis='y', alpha=0.3)
ax1.tick_params(axis='y', labelsize=10)

# Аннотация CAGR
ax1.annotate('CAGR 10,8%', xy=(2029, 30.8), xytext=(2025, 42),
             fontsize=11, fontweight='bold', color='#C0392B', fontfamily='serif',
             arrowprops=dict(arrowstyle='->', color='#C0392B', lw=1.5))

# Легенда
from matplotlib.patches import Patch
legend_elements = [
    Patch(facecolor='#5B9BD5', edgecolor='#3A7BBF', label='Факт'),
    Patch(facecolor='#5B9BD5', edgecolor='#3A7BBF', alpha=0.45, hatch='//', label='Прогноз'),
]
ax1.legend(handles=legend_elements, loc='upper left', fontsize=10,
           prop={'family': 'serif'}, frameon=True)

# --- Правый график: Россия ---
bars_ru = ax2.bar(years_ru, volumes_ru, color='#E67E22', width=0.6,
                  edgecolor='#D35400', linewidth=1)

for bar, vol in zip(bars_ru, volumes_ru):
    ax2.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 1,
             f'{vol}', ha='center', va='bottom', fontsize=11, fontweight='bold',
             fontfamily='serif')

ax2.set_xlabel('Год', fontsize=12, fontfamily='serif')
ax2.set_ylabel('Объём рынка, млрд руб.', fontsize=12, fontfamily='serif')
ax2.set_title('Рынок РФ', fontsize=13, fontweight='bold',
              fontfamily='serif', pad=10)
ax2.set_xticks(years_ru)
ax2.set_xticklabels([str(y) for y in years_ru], fontsize=10, fontfamily='serif')
ax2.set_ylim(0, 65)
ax2.spines['top'].set_visible(False)
ax2.spines['right'].set_visible(False)
ax2.grid(axis='y', alpha=0.3)
ax2.tick_params(axis='y', labelsize=10)

ax2.annotate('x8 за 4 года', xy=(2024, 53), xytext=(2022, 58),
             fontsize=11, fontweight='bold', color='#C0392B', fontfamily='serif',
             arrowprops=dict(arrowstyle='->', color='#C0392B', lw=1.5))

plt.tight_layout()
out = Path(__file__).parent / 'market_chart.png'
plt.savefig(out, dpi=200, bbox_inches='tight', facecolor='white')
print(f'OK: {out}')
