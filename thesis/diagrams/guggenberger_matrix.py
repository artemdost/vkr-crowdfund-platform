#!/usr/bin/env python3
"""Матрица покрытия принципов Guggenberger Web3-решениями."""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np

# Данные: строки = решения, столбцы = 7 принципов Guggenberger
solutions = [
    'ICO\n(2017-2018)',
    'IDO\n(2020-н.в.)',
    'DAO-фонды\n(2019-н.в.)',
    'DeFi\n(Juicebox, 2021)',
    'Equity-токены\n(Republic)',
    'Целевая\nплатформа'
]

principles = [
    'П1\nПрограмм.\nправ',
    'П2\nРегулятор.\nсоответствие',
    'П3\nВторичный\nрынок',
    'П4\nПрозрачн.\nотчётности',
    'П5\nРазделение\nролей',
    'П6\nГибкость\nправ',
    'П7\nМеханизмы\nвыхода'
]

# 2 = полностью, 1 = частично, 0 = нет
data = np.array([
    [2, 0, 1, 2, 0, 1, 0],  # ICO
    [2, 0, 2, 2, 1, 1, 0],  # IDO
    [2, 0, 1, 2, 2, 0, 2],  # DAO
    [2, 0, 1, 2, 1, 1, 0],  # DeFi
    [1, 1, 0, 1, 1, 1, 1],  # Republic
    [2, 2, 2, 2, 2, 2, 2],  # Target
])

# Цвета
colors = {0: '#FFCDD2', 1: '#FFF9C4', 2: '#C8E6C9'}
labels = {0: 'Нет', 1: 'Частично', 2: 'Да'}

fig, ax = plt.subplots(figsize=(13, 7.5))

n_rows, n_cols = data.shape

for i in range(n_rows):
    for j in range(n_cols):
        val = data[i, j]
        rect = plt.Rectangle((j, n_rows - 1 - i), 1, 1,
                              facecolor=colors[val],
                              edgecolor='#9E9E9E', linewidth=1.2)
        ax.add_patch(rect)
        ax.text(j + 0.5, n_rows - 1 - i + 0.5, labels[val],
                ha='center', va='center', fontsize=10,
                fontfamily='serif', fontweight='bold' if val == 2 and i == 5 else 'normal',
                color='#1B5E20' if val == 2 else '#B71C1C' if val == 0 else '#F57F17')

# Оси
ax.set_xlim(0, n_cols)
ax.set_ylim(0, n_rows)
ax.set_xticks([j + 0.5 for j in range(n_cols)])
ax.set_xticklabels(principles, fontsize=9, fontfamily='serif')
ax.xaxis.set_ticks_position('top')
ax.xaxis.set_label_position('top')

ax.set_yticks([i + 0.5 for i in range(n_rows)])
ax.set_yticklabels(list(reversed(solutions)), fontsize=10, fontfamily='serif')

# Выделить строку "Целевая платформа"
rect_highlight = plt.Rectangle((0, 0), n_cols, 1,
                                facecolor='none', edgecolor='#1B5E20',
                                linewidth=3, linestyle='-')
ax.add_patch(rect_highlight)

ax.tick_params(axis='both', which='both', length=0)

# Рамка
for spine in ax.spines.values():
    spine.set_visible(True)
    spine.set_color('#9E9E9E')
    spine.set_linewidth(1.2)

# Легенда
legend_patches = [
    mpatches.Patch(facecolor=colors[2], edgecolor='#9E9E9E', label='Реализовано'),
    mpatches.Patch(facecolor=colors[1], edgecolor='#9E9E9E', label='Частично'),
    mpatches.Patch(facecolor=colors[0], edgecolor='#9E9E9E', label='Не реализовано'),
]
ax.legend(handles=legend_patches, loc='lower right',
          fontsize=10, frameon=True, fancybox=True,
          prop={'family': 'serif'}, bbox_to_anchor=(1.0, -0.1))

# Подпись источника
ax.text(n_cols / 2, -0.6, 'Принципы по Guggenberger et al. (2023)',
        ha='center', va='center', fontsize=9, fontfamily='serif',
        color='#757575', style='italic')

plt.tight_layout()
plt.savefig('guggenberger_matrix.png', dpi=200, bbox_inches='tight',
            facecolor='white', edgecolor='none')
print("OK: guggenberger_matrix.png")
