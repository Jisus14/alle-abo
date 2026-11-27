import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  visible: boolean;
  value: string; // YYYY-MM-DD
  title?: string;
  onSelect: (dateStr: string) => void;
  onClose: () => void;
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function formatYMD(year: number, monthIndex: number, day: number): string {
  return `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
}

function parseYMD(str: string): Date {
  const parts = str.split('-').map(Number);
  if (parts.length === 3 && !parts.some(isNaN)) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  return new Date();
}

export function DatePickerModal({
  visible,
  value,
  title = 'Select Date',
  onSelect,
  onClose,
}: Props) {
  const initial = parseYMD(value);
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  useEffect(() => {
    if (visible) {
      const d = parseYMD(value);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [visible, value]);

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
  // Convert Sunday=0..Saturday=6 into Monday=0..Sunday=6
  const startOffset = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function shiftMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  function applyQuickOffset(days?: number, months?: number, years?: number) {
    const d = new Date();
    if (days) d.setDate(d.getDate() + days);
    if (months) d.setMonth(d.getMonth() + months);
    if (years) d.setFullYear(d.getFullYear() + years);
    onSelect(formatYMD(d.getFullYear(), d.getMonth(), d.getDate()));
    onClose();
  }

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>

          <View style={styles.quickRow}>
            <TouchableOpacity style={styles.quickBtn} onPress={() => applyQuickOffset(14)}>
              <Text style={styles.quickText}>+14d</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickBtn} onPress={() => applyQuickOffset(0, 1)}>
              <Text style={styles.quickText}>+1m</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickBtn} onPress={() => applyQuickOffset(0, 3)}>
              <Text style={styles.quickText}>+3m</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickBtn} onPress={() => applyQuickOffset(0, 0, 1)}>
              <Text style={styles.quickText}>+1y</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.navRow}>
            <TouchableOpacity style={styles.navBtn} onPress={() => shiftMonth(-1)}>
              <Text style={styles.navText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.monthLabel}>
              {MONTHS[viewMonth]} {viewYear}
            </Text>
            <TouchableOpacity style={styles.navBtn} onPress={() => shiftMonth(1)}>
              <Text style={styles.navText}>›</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.grid}>
            {WEEKDAYS.map((wd) => (
              <Text key={wd} style={styles.weekday}>
                {wd}
              </Text>
            ))}
            {cells.map((day, idx) => {
              if (!day) return <View key={`empty-${idx}`} style={styles.cell} />;
              const dateStr = formatYMD(viewYear, viewMonth, day);
              const selected = dateStr === value;
              return (
                <TouchableOpacity
                  key={dateStr}
                  style={[styles.cell, selected && styles.cellSelected]}
                  onPress={() => {
                    onSelect(dateStr);
                    onClose();
                  }}
                >
                  <Text style={[styles.cellText, selected && styles.cellTextSelected]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#1e293b', borderRadius: 14, padding: 16, gap: 12 },
  title: { color: '#f8fafc', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  quickRow: { flexDirection: 'row', gap: 8 },
  quickBtn: { flex: 1, backgroundColor: '#334155', paddingVertical: 6, borderRadius: 6, alignItems: 'center' },
  quickText: { color: '#38bdf8', fontSize: 12, fontWeight: '700' },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  navBtn: { paddingHorizontal: 14, paddingVertical: 4, backgroundColor: '#0f172a', borderRadius: 8 },
  navText: { color: '#f8fafc', fontSize: 20, fontWeight: '700' },
  monthLabel: { color: '#f8fafc', fontSize: 16, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: '14.28%', textAlign: 'center', color: '#94a3b8', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  cell: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  cellSelected: { backgroundColor: '#38bdf8' },
  cellText: { color: '#f8fafc', fontSize: 14, fontWeight: '500' },
  cellTextSelected: { color: '#0f172a', fontWeight: '700' },
  cancelBtn: { backgroundColor: '#334155', padding: 10, borderRadius: 8, alignItems: 'center' },
  cancelText: { color: '#f8fafc', fontWeight: '600' },
});