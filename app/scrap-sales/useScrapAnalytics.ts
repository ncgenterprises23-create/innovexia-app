import { useMemo } from 'react';

export interface ScrapRow {
  Timestamp: string;
  Date: string;
  Week: string;
  Month: string;
  Quarter: string;
  Year: string;
  'Item Description': string;
  qty: number;
  weight: number;
}

export interface ScrapFilters {
  year: string;
  quarter: string;
  month: string;
  week: string;
  date: string;
  item: string;
}

export function useScrapAnalytics(data: ScrapRow[], filters: ScrapFilters) {
  return useMemo(() => {
    // 1. Apply Filters
    let filtered = data;
    if (filters.year) filtered = filtered.filter(d => String(d.Year) === filters.year);
    if (filters.quarter) filtered = filtered.filter(d => d.Quarter === filters.quarter);
    if (filters.month) filtered = filtered.filter(d => d.Month === filters.month);
    if (filters.week) filtered = filtered.filter(d => d.Week === filters.week);
    if (filters.date) filtered = filtered.filter(d => d.Date === filters.date);
    if (filters.item) filtered = filtered.filter(d => d['Item Description'] === filters.item);

    // 2. Compute KPIs
    const totalWeight = filtered.reduce((sum, item) => sum + item.weight, 0);
    const totalQty = filtered.reduce((sum, item) => sum + item.qty, 0);
    const totalTransactions = filtered.length;
    
    const uniqueItems = new Set(filtered.map(d => d['Item Description']));
    const uniqueScrapTypes = uniqueItems.size;

    const todayStr = new Date().toISOString().split('T')[0];
    const todayScrap = filtered.filter(d => d.Date === todayStr).reduce((sum, item) => sum + item.weight, 0);

    const uniqueDays = new Set(filtered.map(d => d.Date)).size || 1;
    const avgScrapPerDay = totalWeight / uniqueDays;
    const avgWeightPerTransaction = totalTransactions > 0 ? totalWeight / totalTransactions : 0;

    // Group by Date for Highest Day and Daily Trend
    const dailyMap = filtered.reduce((acc, row) => {
      if (!acc[row.Date]) acc[row.Date] = { date: row.Date, weight: 0, qty: 0 };
      acc[row.Date].weight += row.weight;
      acc[row.Date].qty += row.qty;
      return acc;
    }, {} as Record<string, { date: string, weight: number, qty: number }>);

    const dailyTrend = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
    const highestScrapDay = dailyTrend.length > 0 
        ? dailyTrend.reduce((max, d) => d.weight > max.weight ? d : max, dailyTrend[0])
        : { date: 'N/A', weight: 0 };

    // Group by Week
    const weeklyMap = filtered.reduce((acc, row) => {
        const key = `${row.Year}-${row.Week}`;
        if (!acc[key]) acc[key] = { name: row.Week, weight: 0, qty: 0 };
        acc[key].weight += row.weight;
        acc[key].qty += row.qty;
        return acc;
    }, {} as Record<string, any>);
    const weeklyTrend = Object.values(weeklyMap);

    // Group by Month
    const monthlyMap = filtered.reduce((acc, row) => {
        const key = `${row.Year}-${row.Month}`;
        if (!acc[key]) acc[key] = { name: row.Month, weight: 0, qty: 0 };
        acc[key].weight += row.weight;
        acc[key].qty += row.qty;
        return acc;
    }, {} as Record<string, any>);
    const monthlyTrend = Object.values(monthlyMap);

    // Group by Quarter
    const quarterlyMap = filtered.reduce((acc, row) => {
        const key = `${row.Year}-${row.Quarter}`;
        if (!acc[key]) acc[key] = { name: row.Quarter, weight: 0, qty: 0 };
        acc[key].weight += row.weight;
        acc[key].qty += row.qty;
        return acc;
    }, {} as Record<string, any>);
    const quarterlyTrend = Object.values(quarterlyMap);

    // Group by Item (For Pareto, Ranking, etc)
    const itemMap = filtered.reduce((acc, row) => {
        const key = row['Item Description'] || 'Unknown';
        if (!acc[key]) acc[key] = { name: key, weight: 0, qty: 0, entries: 0 };
        acc[key].weight += row.weight;
        acc[key].qty += row.qty;
        acc[key].entries += 1;
        return acc;
    }, {} as Record<string, { name: string, weight: number, qty: number, entries: number }>);

    const itemRanking = Object.values(itemMap)
        .sort((a, b) => b.weight - a.weight)
        .map((item, index) => ({
            rank: index + 1,
            ...item,
            avgWeight: item.entries > 0 ? item.weight / item.entries : 0,
            contribution: totalWeight > 0 ? (item.weight / totalWeight) * 100 : 0
        }));

    // Pareto Analysis Data
    let cumulativeWeight = 0;
    const paretoData = itemRanking.map(item => {
        cumulativeWeight += item.weight;
        return {
            name: item.name,
            weight: item.weight,
            cumulativePercent: totalWeight > 0 ? (cumulativeWeight / totalWeight) * 100 : 0
        };
    });

    // Heatmap Matrix (Item vs Date)
    // For performance, let's just take the last 14 unique days if there are too many
    const last14Days = Array.from(new Set(dailyTrend.map(d => d.date))).slice(-14);
    
    const heatmapData = itemRanking.map(item => {
        const rowData: any = { item: item.name };
        last14Days.forEach(date => {
            const sumForDateItem = filtered
                .filter(d => d.Date === date && d['Item Description'] === item.name)
                .reduce((s, d) => s + d.weight, 0);
            rowData[date] = sumForDateItem;
        });
        return rowData;
    });

    // Smart Insights
    const insights = [];
    if (itemRanking.length > 0) {
        insights.push(`Highest scrap generating item is ${itemRanking[0].name} contributing ${itemRanking[0].contribution.toFixed(1)}% of total weight.`);
    }
    if (highestScrapDay.weight > 0) {
        const d = new Date(highestScrapDay.date);
        const formattedDate = isNaN(d.getTime()) ? highestScrapDay.date.split('T')[0] : d.toLocaleDateString();
        insights.push(`Highest scrap day was ${formattedDate} with ${highestScrapDay.weight} kg.`);
    }
    insights.push(`Average daily scrap is ${avgScrapPerDay.toFixed(1)} kg.`);

    return {
      filteredData: filtered,
      kpis: {
        totalWeight,
        totalQty,
        totalTransactions,
        uniqueScrapTypes,
        todayScrap,
        avgScrapPerDay,
        avgWeightPerTransaction,
        highestScrapDay
      },
      trends: {
        daily: dailyTrend,
        weekly: weeklyTrend,
        monthly: monthlyTrend,
        quarterly: quarterlyTrend
      },
      itemRanking,
      paretoData,
      heatmapData,
      heatmapDays: last14Days,
      insights
    };
  }, [data, filters]);
}
