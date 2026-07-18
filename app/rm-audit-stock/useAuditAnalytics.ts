import { useMemo, useState, useEffect } from 'react';

export interface AuditRecord {
  timestamp: string;
  date: string; // YYYY-MM-DD
  week: string; // W26
  month: string; // Jul
  quarter: string; // Q3
  year: string; // 2026
  rawMaterial: string;
  liveStock: number;
  actualStock: number;
  diff: number;
  unit?: string;
}

export function useAuditAnalytics() {
  const [data, setData] = useState<AuditRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters
  const [selectedYear, setSelectedYear] = useState<string>('All');
  const [selectedQuarter, setSelectedQuarter] = useState<string>('All');
  const [selectedMonth, setSelectedMonth] = useState<string>('All');
  const [selectedWeek, setSelectedWeek] = useState<string>('All');
  const [selectedMaterial, setSelectedMaterial] = useState<string>('All');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/rm-audit-stock');
        const json = await res.json();
        setData(json);
      } catch (e) {
        console.error('Failed to fetch audit stock data', e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Unique Filter Options
  const years = useMemo(() => ['All', ...Array.from(new Set(data.map(d => String(d.year)))).sort()], [data]);
  const quarters = useMemo(() => ['All', ...Array.from(new Set(data.map(d => d.quarter))).sort()], [data]);
  const months = useMemo(() => ['All', ...Array.from(new Set(data.map(d => d.month)))], [data]);
  const weeks = useMemo(() => ['All', ...Array.from(new Set(data.map(d => d.week))).sort()], [data]);
  const materials = useMemo(() => ['All', ...Array.from(new Set(data.map(d => d.rawMaterial))).sort()], [data]);

  // Filtered Data
  const filteredData = useMemo(() => {
    return data.filter(d => {
      if (selectedYear !== 'All' && String(d.year) !== selectedYear) return false;
      if (selectedQuarter !== 'All' && d.quarter !== selectedQuarter) return false;
      if (selectedMonth !== 'All' && d.month !== selectedMonth) return false;
      if (selectedWeek !== 'All' && d.week !== selectedWeek) return false;
      if (selectedMaterial !== 'All' && d.rawMaterial !== selectedMaterial) return false;
      return true;
    });
  }, [data, selectedYear, selectedQuarter, selectedMonth, selectedWeek, selectedMaterial]);

  // 1. Executive Summary
  const executiveSummary = useMemo(() => {
    let totalLive = 0;
    let totalActual = 0;
    let totalDiff = 0;
    let excessStock = 0;
    let shortageStock = 0;
    let perfectMatch = 0;
    
    const uniqueMaterials = new Set(filteredData.map(d => d.rawMaterial)).size;

    filteredData.forEach(d => {
      totalLive += d.liveStock;
      totalActual += d.actualStock;
      totalDiff += d.diff;
      if (d.diff > 0) excessStock += d.diff;
      if (d.diff < 0) shortageStock += d.diff;
      if (d.diff === 0) perfectMatch++;
    });

    const accuracy = filteredData.length > 0 
      ? ((perfectMatch / filteredData.length) * 100).toFixed(2)
      : '0.00';

    const lastUpdated = data.length > 0 ? data[data.length - 1].timestamp : 'N/A';

    return {
      totalMaterials: uniqueMaterials,
      totalLive: parseFloat(totalLive.toFixed(2)),
      totalActual: parseFloat(totalActual.toFixed(2)),
      totalDiff: parseFloat(totalDiff.toFixed(2)),
      excessStock: parseFloat(excessStock.toFixed(2)),
      shortageStock: parseFloat(shortageStock.toFixed(2)),
      perfectMatch,
      accuracy,
      lastUpdated
    };
  }, [filteredData, data]);

  // Grouped by Material (for 2, 3, 4, 5, 6, 10, 11, 12, 13, 14, 15, 16, 17, 19, 20)
  const materialStats = useMemo(() => {
    const stats: Record<string, any> = {};
    filteredData.forEach(d => {
      if (!stats[d.rawMaterial]) {
        stats[d.rawMaterial] = {
          rawMaterial: d.rawMaterial,
          liveStock: 0,
          actualStock: 0,
          diff: 0,
          unit: d.unit || '',
          checks: 0,
          matches: 0,
          excessCount: 0,
          shortageCount: 0,
          mismatches: 0,
          lastDiff: 0,
          lastVerified: d.timestamp, // Will just take the latest assuming chronological order
          history: [] // For Material Movement History
        };
      }
      const s = stats[d.rawMaterial];
      s.liveStock += d.liveStock;
      s.actualStock += d.actualStock;
      s.diff += d.diff;
      s.checks += 1;
      // preserve unit if present (prefer first seen)
      if (!s.unit && d.unit) s.unit = d.unit;
      if (d.diff === 0) s.matches += 1;
      else s.mismatches += 1;
      
      if (d.diff > 0) s.excessCount += 1;
      if (d.diff < 0) s.shortageCount += 1;
      
      s.lastDiff = d.diff;
      s.lastVerified = d.timestamp;
      s.history.push(d);
    });

    // Post-process stats
    return Object.values(stats).map(s => {
      const variancePercent = s.liveStock > 0 ? (s.diff / s.liveStock) * 100 : 0;
      let status = 'Matched';
      if (variancePercent < -5) status = 'Major Shortage';
      else if (variancePercent < 0) status = 'Minor Shortage';
      else if (variancePercent > 0) status = 'Excess';

      let impact = 'Low';
      if (Math.abs(variancePercent) > 10 || Math.abs(s.diff) > 100) impact = 'High';
      else if (Math.abs(variancePercent) > 5) impact = 'Medium';

      let severity = 'Low';
      if (s.diff < -50) severity = 'Critical';
      else if (s.diff < -20) severity = 'High';
      else if (s.diff < 0) severity = 'Medium';

      // Health Score
      const accuracyPercent = (s.matches / s.checks) * 100;
      let riskLevel = 'None';
      let health = '🟢 Excellent';
      if (accuracyPercent < 80) { riskLevel = 'High'; health = '🔴 Poor'; }
      else if (accuracyPercent < 95) { riskLevel = 'Medium'; health = '🟡 Good'; }

      // History processing
      const recentHistory = s.history.slice(-7);
      const avgLive = recentHistory.reduce((acc: number, h: any) => acc + h.liveStock, 0) / (recentHistory.length || 1);
      const avgActual = recentHistory.reduce((acc: number, h: any) => acc + h.actualStock, 0) / (recentHistory.length || 1);
      const avgDiff = recentHistory.reduce((acc: number, h: any) => acc + h.diff, 0) / (recentHistory.length || 1);

      return {
        ...s,
          unit: s.unit || '',
        variancePercent: parseFloat(variancePercent.toFixed(2)),
        status,
        impact,
        severity,
        accuracyPercent: parseFloat(accuracyPercent.toFixed(2)),
        riskLevel,
        health,
        avgLive: parseFloat(avgLive.toFixed(2)),
        avgActual: parseFloat(avgActual.toFixed(2)),
        avgDiff: parseFloat(avgDiff.toFixed(2)),
        recentHistoryCount: recentHistory.length
      };
    });
  }, [filteredData]);

  // 2. Raw Material Summary
  const rawMaterialSummary = [...materialStats];

  // 3. Variance Ranking (Sorted by absolute diff)
  const varianceRanking = [...materialStats].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  // 4. Excess Stock Report
  const excessStockReport = materialStats.filter(s => s.diff > 0).sort((a, b) => b.diff - a.diff).map(s => ({
      ...s, remarks: s.diff > 100 ? 'Physical recount needed' : 'Verify inward entry'
  }));

  // 5. Shortage Report
  const shortageReport = materialStats.filter(s => s.diff < 0).sort((a, b) => a.diff - b.diff); // Most negative first

  // 6. Perfect Match Report
  const perfectMatchReport = materialStats.filter(s => s.diff === 0);

  // 7. Daily Stock Verification
  const dailySummary = useMemo(() => {
    const daily: Record<string, any> = {};
    filteredData.forEach(d => {
      if (!daily[d.date]) {
        daily[d.date] = { date: d.date, checks: 0, matched: 0, excess: 0, shortage: 0 };
      }
      daily[d.date].checks++;
      if (d.diff === 0) daily[d.date].matched++;
      if (d.diff > 0) daily[d.date].excess++;
      if (d.diff < 0) daily[d.date].shortage++;
    });
    return Object.values(daily).map(d => ({
        ...d,
        accuracy: parseFloat(((d.matched / d.checks) * 100).toFixed(2))
    })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredData]);

  // 8. Weekly Verification Summary
  const weeklySummary = useMemo(() => {
    const weekly: Record<string, any> = {};
    filteredData.forEach(d => {
        const key = `${d.year}-${d.week}`;
        if (!weekly[key]) {
            weekly[key] = { week: d.week, year: d.year, checks: 0, totalDiff: 0, matched: 0 };
        }
        weekly[key].checks++;
        weekly[key].totalDiff = parseFloat((weekly[key].totalDiff + d.diff).toFixed(2));
        if (d.diff === 0) weekly[key].matched++;
    });
    return Object.values(weekly).map(w => ({
        ...w,
        accuracy: parseFloat(((w.matched / w.checks) * 100).toFixed(2)),
        verifiedBy: 'System Auto' // Auto-generated since we lack this data
    })).sort((a, b) => b.year - a.year || b.week.localeCompare(a.week));
  }, [filteredData]);

  // 9. Monthly Reconciliation
  const monthlySummary = useMemo(() => {
    const monthly: Record<string, any> = {};
    filteredData.forEach(d => {
        const key = `${d.year}-${d.month}`;
        if (!monthly[key]) {
            monthly[key] = { month: d.month, year: d.year, live: 0, actual: 0, diff: 0, checks: 0, matched: 0 };
        }
        monthly[key].live = parseFloat((monthly[key].live + d.liveStock).toFixed(2));
        monthly[key].actual = parseFloat((monthly[key].actual + d.actualStock).toFixed(2));
        monthly[key].diff = parseFloat((monthly[key].diff + d.diff).toFixed(2));
        monthly[key].checks++;
        if (d.diff === 0) monthly[key].matched++;
    });
    return Object.values(monthly).map(m => ({
        ...m,
        accuracy: parseFloat(((m.matched / m.checks) * 100).toFixed(2))
    })).sort((a, b) => b.year - a.year); // Basic sort
  }, [filteredData]);

  // 10. Material Accuracy Ranking
  const materialAccuracyRanking = [...materialStats].sort((a, b) => b.accuracyPercent - a.accuracyPercent);

  // 11. Frequently Mismatched Materials
  const frequentMismatches = [...materialStats].filter(s => s.mismatches > 0).sort((a, b) => b.mismatches - a.mismatches);

  // 12. Largest Difference Report (Record level)
  const largestDifference = [...filteredData].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 50);

  // 18. Audit Summary (Aggregated by Date since no Auditor name)
  const auditSummary = [...dailySummary]; // Mimicking audit summary using daily summary

  // 20. Management Action Report
  const actionReport = useMemo(() => {
      const reports: any[] = [];
      materialStats.forEach(s => {
          if (s.severity === 'Critical') {
              reports.push({ priority: 'High', material: s.rawMaterial, issue: 'Large Shortage', action: 'Physical Verification', owner: 'Store Manager' });
          } else if (s.mismatches > 10) {
              reports.push({ priority: 'High', material: s.rawMaterial, issue: 'Frequent Mismatch', action: 'Audit Stock Register', owner: 'Inventory Team' });
          } else if (s.status === 'Excess' && s.diff > 50) {
              reports.push({ priority: 'Medium', material: s.rawMaterial, issue: 'Excess Stock', action: 'Validate GRN Entries', owner: 'Purchase Team' });
          }
      });
      return reports;
  }, [materialStats]);

  // Weekly Matrix (Material -> Week -> Diff)
  const weeklyMatrix = useMemo(() => {
    const matrix: any[] = [];
    const allMaterials = Array.from(new Set(filteredData.map(d => d.rawMaterial))).sort();
    const availableWeeks = Array.from(new Set(filteredData.map(d => `${d.year}-${d.week}`))).sort();
    
    allMaterials.forEach(material => {
      const row: any = { material };
      availableWeeks.forEach(week => {
        const item = filteredData.find(d => d.rawMaterial === material && `${d.year}-${d.week}` === week);
        if (item) {
          const val = parseFloat(item.diff.toFixed(2));
          row[week] = { value: val, unit: item.unit || '' };
        } else {
          row[week] = '-';
        }
      });
      matrix.push(row);
    });
    return { weeks: availableWeeks, data: matrix };
  }, [filteredData]);

  // Monthly Matrix (Material -> Month -> Diff)
  const monthlyMatrix = useMemo(() => {
    const matrix: any[] = [];
    const allMaterials = Array.from(new Set(filteredData.map(d => d.rawMaterial))).sort();
    const availableMonths = Array.from(new Set(filteredData.map(d => `${d.month} ${String(d.year).slice(-2)}`))).sort();
    
    allMaterials.forEach(material => {
      const row: any = { material };
      availableMonths.forEach(month => {
        const matchingItems = filteredData.filter(d => d.rawMaterial === material && `${d.month} ${String(d.year).slice(-2)}` === month);
        if (matchingItems.length > 0) {
           const totalDiff = matchingItems.reduce((acc, curr) => acc + curr.diff, 0);
           const unit = matchingItems[0].unit || '';
           row[month] = { value: parseFloat(totalDiff.toFixed(2)), unit };
        } else {
           row[month] = '-';
        }
      });
      matrix.push(row);
    });
    return { months: availableMonths, data: matrix };
  }, [filteredData]);

  return {
    isLoading,
    
    // Filters
    filters: {
        years, selectedYear, setSelectedYear,
        quarters, selectedQuarter, setSelectedQuarter,
        months, selectedMonth, setSelectedMonth,
        weeks, selectedWeek, setSelectedWeek,
        materials, selectedMaterial, setSelectedMaterial
    },

    // Metrics
    executiveSummary,
    rawMaterialSummary,
    varianceRanking,
    excessStockReport,
    shortageReport,
    perfectMatchReport,
    dailySummary,
    weeklySummary,
    monthlySummary,
    materialAccuracyRanking,
    frequentMismatches,
    largestDifference,
    materialMovementHistory: materialStats,
    materialHealthScore: materialStats,
    topPositiveVariance: excessStockReport,
    topNegativeVariance: shortageReport,
    auditSummary,
    materialPerformanceMatrix: materialStats,
    actionReport,
    weeklyMatrix,
    monthlyMatrix
  };
}
