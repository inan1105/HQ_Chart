"use client";

import { useEffect, useRef } from "react";
import { createChart, IChartApi, ISeriesApi, CandlestickData, HistogramData, LineData, Time } from "lightweight-charts";
import { OHLCV } from "@/types";
import { sma, bollingerBands, macd } from "@/lib/indicators";

interface Props {
  data: OHLCV[];
  height?: number;
}

export default function ChartWidget({ data, height = 500 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { color: "#1f2937" },
        textColor: "#9ca3af",
      },
      grid: {
        vertLines: { color: "#374151" },
        horzLines: { color: "#374151" },
      },
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: "#374151" },
      timeScale: { borderColor: "#374151", timeVisible: false },
    });
    chartRef.current = chart;

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#ef4444",
      downColor: "#3b82f6",
      borderUpColor: "#ef4444",
      borderDownColor: "#3b82f6",
      wickUpColor: "#ef4444",
      wickDownColor: "#3b82f6",
    });

    const candleData: CandlestickData[] = data.map((d) => ({
      time: d.date as Time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));
    candleSeries.setData(candleData);

    const closes = data.map((d) => d.close);

    const addLine = (values: number[], color: string) => {
      const series = chart.addLineSeries({ color, lineWidth: 1, priceLineVisible: false });
      const lineData: LineData[] = [];
      values.forEach((v, i) => {
        if (!isNaN(v)) lineData.push({ time: data[i].date as Time, value: v });
      });
      series.setData(lineData);
    };

    addLine(sma(closes, 5), "#2d6cdf");
    addLine(sma(closes, 20), "#ef8f22");
    addLine(sma(closes, 60), "#16815c");

    const bb = bollingerBands(closes, 20, 2);
    addLine(bb.upper, "#697386");
    addLine(bb.lower, "#697386");

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });
    const volumeData: HistogramData[] = data.map((d) => ({
      time: d.date as Time,
      value: d.volume,
      color: d.close >= d.open ? "rgba(239,68,68,0.3)" : "rgba(59,130,246,0.3)",
    }));
    volumeSeries.setData(volumeData);

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [data, height]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-panel rounded-lg border border-border text-gray-500">
        데이터를 로딩 중이거나 없습니다.
      </div>
    );
  }

  return <div ref={containerRef} className="rounded-lg overflow-hidden" />;
}
