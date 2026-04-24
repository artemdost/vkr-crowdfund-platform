#!/usr/bin/env python3
"""Схема взаимодействия участников краудфандинга: потоки денег и информации."""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import numpy as np

fig, ax = plt.subplots(figsize=(14, 8))
ax.set_xlim(0, 14)
ax.set_ylim(0, 8)
ax.axis('off')

# --- Цвета ---
COLOR_CREATOR = '#E8F5E9'
COLOR_PLATFORM = '#FFF3E0'
COLOR_INVESTOR = '#E3F2FD'
BORDER_CREATOR = '#388E3C'
BORDER_PLATFORM = '#F57C00'
BORDER_INVESTOR = '#1976D2'
ARROW_MONEY = '#C62828'
ARROW_INFO = '#1565C0'
ARROW_PRODUCT = '#2E7D32'

def draw_actor(ax, x, y, w, h, label, sublabel, facecolor, edgecolor):
    box = FancyBboxPatch((x - w/2, y - h/2), w, h,
                         boxstyle="round,pad=0.15",
                         facecolor=facecolor, edgecolor=edgecolor, linewidth=2.5)
    ax.add_patch(box)
    ax.text(x, y + 0.15, label, ha='center', va='center',
            fontsize=14, fontweight='bold', fontfamily='serif', color='#212121')
    ax.text(x, y - 0.35, sublabel, ha='center', va='center',
            fontsize=9.5, fontfamily='serif', color='#616161', style='italic')

# --- Акторы ---
# Автор проекта (слева)
draw_actor(ax, 2.5, 4, 3.5, 2.2, 'Автор проекта',
           '(создатель кампании)', COLOR_CREATOR, BORDER_CREATOR)

# Платформа (центр)
draw_actor(ax, 7, 4, 3.5, 2.2, 'Платформа',
           '(единственный посредник)', COLOR_PLATFORM, BORDER_PLATFORM)

# Инвестор (справа)
draw_actor(ax, 11.5, 4, 3.5, 2.2, 'Инвестор',
           '(бэкер / вкладчик)', COLOR_INVESTOR, BORDER_INVESTOR)

# --- Стрелки ---
arrow_kw_money = dict(arrowstyle='->', color=ARROW_MONEY, lw=2.2,
                      connectionstyle='arc3,rad=0.2', mutation_scale=18)
arrow_kw_info = dict(arrowstyle='->', color=ARROW_INFO, lw=2.2,
                     connectionstyle='arc3,rad=0.2', mutation_scale=18,
                     linestyle='--')
arrow_kw_product = dict(arrowstyle='->', color=ARROW_PRODUCT, lw=2.2,
                        connectionstyle='arc3,rad=-0.35', mutation_scale=18)

# Деньги: Инвестор -> Платформа
ax.annotate('', xy=(8.85, 4.6), xytext=(9.65, 4.6), arrowprops=arrow_kw_money)
ax.text(9.25, 5.4, 'Денежные\nсредства', ha='center', va='center',
        fontsize=9, fontfamily='serif', color=ARROW_MONEY, fontweight='bold')

# Деньги: Платформа -> Автор (минус комиссия)
ax.annotate('', xy=(4.35, 4.6), xytext=(5.15, 4.6), arrowprops=arrow_kw_money)
ax.text(4.75, 5.55, 'Средства\n(минус 8-15%\nкомиссии)', ha='center', va='center',
        fontsize=9, fontfamily='serif', color=ARROW_MONEY, fontweight='bold')

# Информация: Автор -> Платформа (описание проекта)
ax.annotate('', xy=(5.15, 3.4), xytext=(4.35, 3.4), arrowprops=arrow_kw_info)
ax.text(4.75, 2.55, 'Описание проекта,\nотчёты (добровольные)', ha='center', va='center',
        fontsize=9, fontfamily='serif', color=ARROW_INFO)

# Информация: Платформа -> Инвестор (каталог)
ax.annotate('', xy=(9.65, 3.4), xytext=(8.85, 3.4), arrowprops=arrow_kw_info)
ax.text(9.25, 2.55, 'Каталог проектов,\nстатус сбора', ha='center', va='center',
        fontsize=9, fontfamily='serif', color=ARROW_INFO)

# Продукт/результат: Автор -> Инвестор (прямая, минуя платформу, снизу)
ax.annotate('', xy=(9.65, 2.0), xytext=(4.35, 2.0),
            arrowprops=dict(arrowstyle='->', color=ARROW_PRODUCT, lw=2.0,
                           connectionstyle='arc3,rad=0', mutation_scale=16))
ax.text(7, 1.45, 'Продукт / вознаграждение (без гарантий платформы)',
        ha='center', va='center', fontsize=9, fontfamily='serif',
        color=ARROW_PRODUCT, style='italic')

# --- Проблемные зоны (аннотации) ---
# Рамка "Информационная асимметрия"
asym_box = FancyBboxPatch((5.5, 6.3), 3.0, 1.0,
                           boxstyle="round,pad=0.1",
                           facecolor='#FFEBEE', edgecolor='#C62828',
                           linewidth=1.5, linestyle='--')
ax.add_patch(asym_box)
ax.text(7, 6.8, 'Информационная\nасимметрия', ha='center', va='center',
        fontsize=10, fontfamily='serif', color='#B71C1C', fontweight='bold')

# Стрелка от блока к платформе
ax.annotate('', xy=(7, 5.15), xytext=(7, 6.25),
            arrowprops=dict(arrowstyle='->', color='#C62828', lw=1.5,
                           linestyle=':', mutation_scale=14))

# --- Легенда ---
legend_elements = [
    mpatches.FancyArrowPatch((0,0), (1,0), arrowstyle='->', color=ARROW_MONEY, lw=2),
]
ax.plot([], [], color=ARROW_MONEY, lw=2.2, label='Поток денежных средств')
ax.plot([], [], color=ARROW_INFO, lw=2.2, linestyle='--', label='Поток информации')
ax.plot([], [], color=ARROW_PRODUCT, lw=2.0, label='Продукт / вознаграждение')

ax.legend(loc='lower left', fontsize=10, frameon=True,
          fancybox=True, shadow=False, prop={'family': 'serif'},
          bbox_to_anchor=(0.02, -0.02))

plt.tight_layout()
plt.savefig('crowdfunding_actors.png', dpi=200, bbox_inches='tight',
            facecolor='white', edgecolor='none')
print("OK: crowdfunding_actors.png")
