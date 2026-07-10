import React, { useState, useMemo, useRef, useEffect } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, LineChart, Line, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, ZAxis
} from 'recharts';
import {
  Upload, Download, FileText, AlertTriangle, CheckCircle, Loader2,
  BarChart3, LineChart as LineIcon, ShieldCheck, Database, LayoutDashboard, Code, Copy,
  ArrowRight, Filter, Trash2, UserX, Table, PieChart as PieIcon, Activity, ArrowUpDown, Search, X, RefreshCw, FileSpreadsheet, ScatterChart as ScatterIcon, Sparkles, FileText as PdfIcon,
  Sun, Moon, MessageSquare, Send
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [requestId, setRequestId] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedColumn, setSelectedColumn] = useState('');
  const [yColumn, setYColumn] = useState('');
  const [chartType, setChartType] = useState('Bar');
  const [maskPii, setMaskPii] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  // Pipeline configurations states
  const [imputeNumeric, setImputeNumeric] = useState('median');
  const [anomalyContamination, setAnomalyContamination] = useState(0.05);
  const [runTypoCorrection, setRunTypoCorrection] = useState(true);
  const [typoThreshold, setTypoThreshold] = useState(0.75);
  const [runDateFormatting, setRunDateFormatting] = useState(true);
  const [runNumericParsing, setRunNumericParsing] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Chatbot states
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { role: 'model', content: 'Hello! I am your InfoPulse AI Data Assistant. Ask me anything about your cleaned dataset, anomalies, column profiles, or SQL exports!' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatWidth, setChatWidth] = useState(480);
  const [isResizing, setIsResizing] = useState(false);

  // Global UI states (Dark/Light mode & Tab additions)
  const [darkMode, setDarkMode] = useState(true);
  const [viewerLayout, setViewerLayout] = useState('split'); // 'split' or 'focus'
  const [viewerTab, setViewerTab] = useState('cleaned'); // 'cleaned' or 'original'
  const [profileSort, setProfileSort] = useState('name'); // 'name', 'missing', 'unique', 'type'
  const [chartTheme, setChartTheme] = useState('indigo'); // 'indigo', 'emerald', 'cyberpunk', 'sunset'
  const [sqlDialect, setSqlDialect] = useState('postgres'); // 'postgres', 'sqlite', 'mysql'

  const COLORS = ['#6366f1', '#10b981', '#f59e0b'];
  const GAUGE_COLORS = ['#ef4444', '#f59e0b', '#10b981'];

  // Map chart themes to colors
  const THEME_COLORS = {
    indigo: '#6366f1',
    emerald: '#10b981',
    cyberpunk: '#d946ef',
    sunset: '#f43f5e'
  };

  const handleReset = () => {
    setFile(null);
    setData(null);
    setRequestId(null);
    setSearchQuery('');
    setAiError('');
    setActiveTab('dashboard');
    setShowChat(false);
    setChatMessages([
      { role: 'model', content: 'Hello! I am your InfoPulse AI Data Assistant. Ask me anything about your cleaned dataset, anomalies, column profiles, or SQL exports!' }
    ]);
  };

  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, showChat, chatLoading]);

  const startResizing = (e) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 320 && newWidth < window.innerWidth * 0.8) {
        setChatWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const CodeBlock = ({ code, language }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <div className="my-3 border rounded-xl overflow-hidden shadow-inner bg-slate-950 border-slate-900">
        <div className="flex justify-between items-center px-4 py-2 bg-slate-900 border-b border-slate-950 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
          <span>{language}</span>
          <button
            onClick={handleCopy}
            className="flex items-center space-x-1 hover:text-white transition-colors"
          >
            {copied ? <span>Copied!</span> : <span>Copy</span>}
          </button>
        </div>
        <pre className="p-4 overflow-x-auto custom-scrollbar font-mono text-xs text-slate-300 leading-relaxed text-left">
          <code>{code}</code>
        </pre>
      </div>
    );
  };

  const highlightKeywords = (text) => {
    const keywordsRegex = /\b(outlier|outliers|anomaly|anomalies|critical|missing|duplicate|duplicates|error|failed|good|clean|success|resolved|cleaned|formatted)\b/gi;
    const parts = text.split(keywordsRegex);
    if (parts.length === 1) return text;

    return parts.map((part, i) => {
      const lowerPart = part.toLowerCase();
      if (['outlier', 'outliers', 'anomaly', 'anomalies', 'critical', 'missing', 'duplicate', 'duplicates', 'error', 'failed'].includes(lowerPart)) {
        return (
          <span key={i} className="text-rose-600 dark:text-rose-400 font-bold px-0.5">
            {part}
          </span>
        );
      }
      if (['good', 'clean', 'success', 'resolved', 'cleaned', 'formatted'].includes(lowerPart)) {
        return (
          <span key={i} className="text-emerald-600 dark:text-emerald-400 font-bold px-0.5">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const formatTextSegments = (text) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const cleanPart = part.slice(2, -2);
        return (
          <strong key={i} className={darkMode ? 'font-bold text-white' : 'font-bold text-slate-800'}>
            {highlightKeywords(cleanPart)}
          </strong>
        );
      }
      return <span key={i}>{highlightKeywords(part)}</span>;
    });
  };

  const parseTablesAndText = (text, startingKey) => {
    const lines = text.split('\n');
    const elements = [];
    let currentTableLines = [];
    let isInsideTable = false;
    let key = startingKey;

    const flushTextAccumulator = (accumulatedLines) => {
      if (accumulatedLines.length === 0) return;
      const blockText = accumulatedLines.join('\n');
      elements.push(
        <span key={key++} className="block my-1.5 leading-relaxed">
          {formatTextSegments(blockText)}
        </span>
      );
    };

    const renderParsedTable = (tableLines) => {
      if (tableLines.length < 2) return null;

      const headerLine = tableLines[0];
      const headers = headerLine.split('|')
        .map(cell => cell.trim())
        .filter((_, i, arr) => i > 0 && i < arr.length - 1);

      const dataLines = tableLines.slice(2);
      const rows = dataLines.map(line => {
        return line.split('|')
          .map(cell => cell.trim())
          .filter((_, i, arr) => i > 0 && i < arr.length - 1);
      });

      return (
        <div key={key++} className="my-4 overflow-x-auto border rounded-xl shadow-sm bg-white dark:bg-slate-900 border-indigo-100 dark:border-slate-850">
          <table className="min-w-full text-xs text-left">
            <thead className="bg-indigo-50 dark:bg-slate-800 text-indigo-950 dark:text-slate-200 border-b border-indigo-100 dark:border-slate-800 font-bold">
              <tr>
                {headers.map((h, i) => (
                  <th key={i} className="px-4 py-2.5 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="text-slate-700 dark:text-slate-350 divide-y divide-indigo-50/50 dark:divide-slate-800/40">
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-indigo-50/20 dark:hover:bg-slate-800/20 transition-colors">
                  {row.map((cell, j) => (
                    <td key={j} className="px-4 py-2.5 font-medium whitespace-nowrap">
                      {formatTextSegments(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    };

    let textAccumulator = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const isTableRow = line.startsWith('|') && line.endsWith('|');

      if (isTableRow) {
        if (!isInsideTable) {
          flushTextAccumulator(textAccumulator);
          textAccumulator = [];
          isInsideTable = true;
        }
        currentTableLines.push(lines[i]);
      } else {
        if (isInsideTable) {
          const renderedTable = renderParsedTable(currentTableLines);
          if (renderedTable) elements.push(renderedTable);
          currentTableLines = [];
          isInsideTable = false;
        }
        textAccumulator.push(lines[i]);
      }
    }

    if (isInsideTable) {
      const renderedTable = renderParsedTable(currentTableLines);
      if (renderedTable) elements.push(renderedTable);
    } else {
      flushTextAccumulator(textAccumulator);
    }

    return elements;
  };

  const parseMessageContent = (text) => {
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)\n```/g;
    const blocks = [];
    let lastIndex = 0;
    let match;
    let key = 0;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      const textBefore = text.slice(lastIndex, match.index);
      if (textBefore) {
        blocks.push({ type: 'text', content: textBefore });
      }

      blocks.push({
        type: 'code',
        language: match[1] || 'code',
        content: match[2]
      });

      lastIndex = codeBlockRegex.lastIndex;
    }

    const textAfter = text.slice(lastIndex);
    if (textAfter) {
      blocks.push({ type: 'text', content: textAfter });
    }

    const finalElements = [];
    blocks.forEach((block) => {
      if (block.type === 'code') {
        finalElements.push(
          <CodeBlock key={key++} code={block.content} language={block.language} />
        );
      } else {
        const parsedTextAndTables = parseTablesAndText(block.content, key);
        key += parsedTextAndTables.length;
        finalElements.push(...parsedTextAndTables);
      }
    });

    return finalElements;
  };

  const handleSendChatMessage = async (customMessage = null) => {
    const textToSend = customMessage || chatInput;
    if (!textToSend.trim() || chatLoading) return;

    const userMessage = { role: 'user', content: textToSend };
    const updatedMessages = [...chatMessages, userMessage];
    setChatMessages(updatedMessages);
    setChatInput('');
    setChatLoading(true);

    try {
      const backendHistory = chatMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const response = await axios.post(`${API_BASE_URL}/chat`, {
        message: textToSend,
        history: backendHistory,
        insights: data.insights,
        filename: file?.name || 'dataset.csv'
      });

      setChatMessages(prev => [...prev, { role: 'model', content: response.data.response }]);
    } catch (err) {
      console.error(err);
      setChatMessages(prev => [
        ...prev,
        { role: 'model', content: '❌ **Failed to contact AI Assistant.** Please verify the backend is running and GEMINI_API_KEY is configured properly.' }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setData(null);
    setSearchQuery('');
    setActiveTab('dashboard');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('mask_pii', maskPii);
    formData.append('impute_numeric', imputeNumeric);
    formData.append('anomaly_contamination', anomalyContamination);
    formData.append('run_typo_correction', runTypoCorrection);
    formData.append('typo_threshold', typoThreshold);
    formData.append('run_date_formatting', runDateFormatting);
    formData.append('run_numeric_parsing', runNumericParsing);

    try {
      const response = await axios.post(`${API_BASE_URL}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setData(response.data);
      setRequestId(response.data.request_id);
      if (response.data.insights.numeric_columns.length > 0) {
        const numericCols = response.data.insights.numeric_columns;
        const priorityCol = numericCols.find(col => ['salary', 'age', 'amount', 'price', 'score', 'rating', 'total', 'profit', 'cost'].includes(col.toLowerCase()));
        setSelectedColumn(priorityCol || numericCols[0]);
        setYColumn(numericCols.length > 1 ? numericCols[1] : (priorityCol || numericCols[0]));
      }
    } catch (error) {
      console.error(error);
      alert("Error processing file. Please ensure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleAskAI = async (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      if (searchQuery.match(/[><=]/)) return;
      setAiLoading(true);
      setAiError('');
      try {
        const allColumns = data.insights.column_stats.map(c => c.name);
        const response = await axios.post(`${API_BASE_URL}/ask`, {
          query: searchQuery,
          columns: allColumns
        });
        if (response.data.filter_string) {
          setSearchQuery(response.data.filter_string);
          setAiError(response.data.explanation);
          setTimeout(() => setAiError(''), 3000);
        } else {
          setAiError(response.data.explanation);
        }
      } catch (error) {
        console.error("AI Error", error);
      } finally {
        setAiLoading(false);
      }
    }
  };

  const downloadFile = (format) => {
    if (requestId) {
      window.location.href = `${API_BASE_URL}/download/${requestId}?format=${format}`;
    }
  };

  const copyToClipboard = () => {
    const text = sqlDialectsCode;
    if (text) {
      navigator.clipboard.writeText(text);
      const btn = document.getElementById('copy-btn-text');
      if (btn) {
        const original = btn.innerText;
        btn.innerText = "Copied!";
        setTimeout(() => btn.innerText = original, 2000);
      }
    }
  };

  const filteredData = useMemo(() => {
    if (!data || !data.preview_cleaned) return [];
    if (!searchQuery.trim()) return data.preview_cleaned;
    const query = searchQuery.toLowerCase();
    return data.preview_cleaned.filter(row => {
      const operatorMatch = query.match(/([a-zA-Z0-9_]+)\s*([><=])\s*(.+)/);
      if (operatorMatch) {
        const [_, colName, op, val] = operatorMatch;
        const rowKey = Object.keys(row).find(k => k.toLowerCase() === colName.toLowerCase());
        if (rowKey && row[rowKey] !== undefined) {
          const rowVal = Number(row[rowKey]);
          const targetVal = Number(val);
          if (!isNaN(rowVal) && !isNaN(targetVal)) {
            if (op === '>') return rowVal > targetVal;
            if (op === '<') return rowVal < targetVal;
            if (op === '=') return rowVal === targetVal;
          } else {
            if (op === '=') return String(row[rowKey]).toLowerCase().includes(String(val).toLowerCase());
          }
        }
        return false;
      }
      return Object.values(row).some(val => String(val).toLowerCase().includes(query));
    });
  }, [data, searchQuery]);

  // Client-side statistical aggregator
  const activeColumnStats = useMemo(() => {
    if (!data || !selectedColumn) return null;
    const vals = data.preview_cleaned.map(row => Number(row[selectedColumn])).filter(v => !isNaN(v) && v !== null);
    if (vals.length === 0) return null;

    const count = vals.length;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const sum = vals.reduce((a, b) => a + b, 0);
    const mean = sum / count;

    const sorted = [...vals].sort((a, b) => a - b);
    const median = sorted[Math.floor(count / 2)];

    const variance = vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / count;
    const stdDev = Math.sqrt(variance);

    return {
      count,
      min: min.toLocaleString(),
      max: max.toLocaleString(),
      mean: mean.toFixed(2),
      median: median.toFixed(2),
      stdDev: stdDev.toFixed(2)
    };
  }, [data, selectedColumn]);

  // Client-side dialect schema generator
  const sqlDialectsCode = useMemo(() => {
    if (!data) return "";
    const tableName = "cleaned_dataset";
    const cols = data.insights.column_stats;

    let sql = `-- Generated SQL Script (${sqlDialect.toUpperCase()} Dialect)\n`;
    sql += `CREATE TABLE ${tableName} (\n`;

    const pkType = sqlDialect === 'postgres' ? 'SERIAL PRIMARY KEY' : sqlDialect === 'sqlite' ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INT AUTO_INCREMENT PRIMARY KEY';
    sql += `    id ${pkType},\n`;

    const colDefs = cols.map(col => {
      const colName = col.name.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      let type = "VARCHAR(255)";
      if (col.type === "Numeric") {
        type = sqlDialect === 'sqlite' ? 'NUMERIC' : 'DOUBLE PRECISION';
      } else if (col.type === "Date") {
        type = sqlDialect === 'postgres' ? 'TIMESTAMP' : 'DATETIME';
      }
      return `    ${colName} ${type}`;
    });
    sql += colDefs.join(",\n");
    sql += `\n);\n\n-- Sample Data Inserts (Top 50 rows)\n`;

    const rows = filteredData.length > 0 ? filteredData.slice(0, 50) : data.preview_cleaned.slice(0, 50);
    rows.forEach(row => {
      const vals = cols.map(col => {
        const val = row[col.name];
        if (val === null || val === undefined) return "NULL";
        if (col.type === "Numeric") return val;
        const escaped = String(val).replace(/'/g, "''");
        return `'${escaped}'`;
      });
      const colsList = cols.map(col => col.name.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')).join(", ");
      sql += `INSERT INTO ${tableName} (${colsList}) VALUES (${vals.join(", ")});\n`;
    });

    return sql;
  }, [data, sqlDialect, filteredData]);

  // Comparative Data Summary indicators
  const changesSummary = useMemo(() => {
    if (!data) return null;
    let cellModifications = 0;
    const orig = data.preview_original;
    const clean = data.preview_cleaned;
    const cols = data.insights.column_stats.map(c => c.name);

    for (let i = 0; i < Math.min(orig.length, clean.length); i++) {
      cols.forEach(col => {
        if (orig[i] && clean[i]) {
          if (String(orig[i][col]) !== String(clean[i][col])) {
            cellModifications++;
          }
        }
      });
    }

    return {
      cellModifications,
      outliersRemoved: data.insights.rows_original - data.insights.rows_cleaned,
      duplicates: data.insights.duplicates_removed,
      piiMasked: data.insights.pii_masked
    };
  }, [data]);

  // Schema list sorting
  const sortedColumnStats = useMemo(() => {
    if (!data || !data.insights.column_stats) return [];
    const stats = [...data.insights.column_stats];
    if (profileSort === 'name') {
      stats.sort((a, b) => a.name.localeCompare(b.name));
    } else if (profileSort === 'missing') {
      stats.sort((a, b) => b.missing - a.missing);
    } else if (profileSort === 'unique') {
      stats.sort((a, b) => b.unique - a.unique);
    } else if (profileSort === 'type') {
      stats.sort((a, b) => a.type.localeCompare(b.type));
    }
    return stats;
  }, [data, profileSort]);

  // --- SUB-COMPONENTS ---
  const GaugeChart = ({ score }) => {
    let color = GAUGE_COLORS[0];
    if (score > 50) color = GAUGE_COLORS[1];
    if (score > 80) color = GAUGE_COLORS[2];
    const pieData = [{ name: 'Score', value: score }, { name: 'Remaining', value: 100 - score }];
    return (
      <div className="relative w-48 h-24 mx-auto overflow-hidden group hover:scale-105 transition-transform duration-300">
        <ResponsiveContainer width="100%" height="200%">
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" startAngle={180} endAngle={0} innerRadius={60} outerRadius={80} paddingAngle={0} dataKey="value" stroke="none">
              <Cell key="score" fill={color} />
              <Cell key="rest" fill={darkMode ? '#1e293b' : '#cbd5e1'} />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute bottom-0 w-full text-center">
          <p className={`text-3xl font-extrabold tracking-tight ${darkMode ? 'text-white' : 'text-slate-800'}`}>{score}%</p>
          <p className={`text-[9px] font-bold uppercase tracking-wider ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Health Index</p>
        </div>
      </div>
    );
  };

  const CorrelationHeatmap = ({ matrix }) => {
    if (!matrix || matrix.length === 0) return <div className={`text-center py-10 italic ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>No numeric correlations found.</div>;
    const keys = [...new Set(matrix.map(m => m.x))];
    return (
      <div className="overflow-x-auto custom-scrollbar pb-2">
        <div className="min-w-[500px]">
          <div className="grid animate-fade-in-up" style={{ gridTemplateColumns: `80px repeat(${keys.length}, 1fr)` }}>
            <div className="h-10"></div>
            {keys.map(k => <div key={k} className={`h-10 flex items-center justify-center font-bold text-[9px] uppercase tracking-wider truncate px-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} title={k}>{k}</div>)}
            {keys.map(y => (
              <React.Fragment key={y}>
                <div className={`h-12 flex items-center justify-end pr-3 font-bold text-[9px] uppercase tracking-wider truncate ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} title={y}>{y}</div>
                {keys.map(x => {
                  const item = matrix.find(m => m.x === x && m.y === y);
                  const val = item ? item.value : 0;
                  let bg = val > 0 ? `rgba(99, 102, 241, ${val * 0.85})` : `rgba(244, 63, 94, ${Math.abs(val) * 0.85})`;
                  return (
                    <div
                      key={`${x}-${y}`}
                      className={`h-12 border flex items-center justify-center text-xs font-bold hover:scale-105 hover:shadow-lg transition-all cursor-default ${darkMode ? 'border-slate-900 text-white' : 'border-slate-100 text-slate-900'}`}
                      style={{ backgroundColor: bg, borderRadius: '6px' }}
                      title={`Correlation between ${x} & ${y}: ${val}`}
                    >
                      {val}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const TableWithDiffHighlight = ({ data, origData, title, color }) => {
    if (!data || data.length === 0) return <div className={`p-12 text-center italic rounded-2xl border border-dashed ${darkMode ? 'bg-slate-900/30 border-slate-800 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>No data matches query.</div>;
    const [sortConfig, setSortConfig] = useState(null);
    const columns = Object.keys(data[0]).filter(col => col !== 'anomaly_score' && col !== 'index');

    const sortedData = React.useMemo(() => {
      let sortableItems = [...data];
      if (sortConfig !== null) {
        sortableItems.sort((a, b) => {
          if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'ascending' ? -1 : 1;
          if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'ascending' ? 1 : -1;
          return 0;
        });
      }
      return sortableItems;
    }, [data, sortConfig]);

    const requestSort = (key) => {
      let direction = 'ascending';
      if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
      }
      setSortConfig({ key, direction });
    };

    const renderCellContent = (row, col, idx) => {
      const cleanVal = row[col];
      const origRow = origData ? origData[idx] : null;
      const origVal = origRow ? origRow[col] : undefined;
      const isModified = origVal !== undefined && String(cleanVal) !== String(origVal);

      if (cleanVal === null) {
        return (
          <span className={`px-1.5 py-0.5 rounded font-bold font-mono text-[9px] uppercase tracking-wide border ${darkMode
              ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
              : 'text-rose-700 bg-rose-50 border-rose-205'
            }`}>
            null
          </span>
        );
      }

      if (isModified) {
        return (
          <span
            className={`px-1.5 py-0.5 rounded font-bold border transition-all cursor-help ${darkMode
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/35'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100/70'
              }`}
            title={`Modified from: ${origVal === null ? 'null' : String(origVal)}`}
          >
            {String(cleanVal)}
          </span>
        );
      }

      return String(cleanVal);
    };

    return (
      <div className={`rounded-2xl shadow-xl border overflow-hidden flex-1 flex flex-col h-full animate-fade-in-up ${darkMode ? 'bg-slate-900 border-slate-800/80' : 'bg-white border-slate-200'
        }`}>
        <div className={`p-4 border-b font-extrabold flex items-center justify-between ${darkMode ? 'border-slate-800/85 bg-slate-950/20' : 'border-slate-100 bg-slate-50/50'
          } ${color}`}>
          <div className="flex items-center space-x-2"><Database size={15} /> <span>{title}</span></div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono border ${darkMode ? 'bg-white/5 border-slate-700 text-slate-300' : 'bg-slate-200 border-slate-300 text-slate-600'
            }`}>{data.length} rows</span>
        </div>
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-xs text-left">
            <thead className={`text-[10px] uppercase sticky top-0 z-10 border-b select-none ${darkMode ? 'text-slate-500 bg-slate-950/70 border-slate-800' : 'text-slate-600 bg-slate-100/80 border-slate-200'
              }`}>
              <tr>
                {columns.map(col => (
                  <th key={col} className={`px-4 py-3 font-bold cursor-pointer transition-colors group ${darkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-200/50'
                    }`} onClick={() => requestSort(col)}>
                    <div className="flex items-center space-x-1"><span>{col}</span><ArrowUpDown size={11} className="opacity-0 group-hover:opacity-50" /></div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={darkMode ? 'text-slate-300' : 'text-slate-700'}>
              {sortedData.map((row, i) => (
                <tr key={i} className={`border-b transition-colors ${darkMode ? 'border-slate-800/40 hover:bg-slate-800/30' : 'border-slate-100 hover:bg-slate-50/50'
                  }`}>
                  {columns.map(col => (
                    <td key={col} className="px-4 py-2.5 font-medium whitespace-nowrap max-w-[200px] truncate">
                      {renderCellContent(row, col, i)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const StatCard = ({ title, value, subtext, icon: Icon, color }) => (
    <div className={`p-5 rounded-2xl border shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group ${darkMode
        ? 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
        : 'bg-white border-slate-200 shadow-slate-100'
      }`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2.5 rounded-xl transition-transform group-hover:scale-110 ${color.bg}`}><Icon size={18} className={color.text} /></div>
        <span className={`text-[9px] font-extrabold uppercase tracking-widest ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{title}</span>
      </div>
      <div className="space-y-0.5">
        <h3 className={`text-2xl font-extrabold tracking-tight ${darkMode ? 'text-white' : 'text-slate-800'}`}>{value}</h3>
        {subtext && <p className={`text-[10px] font-medium ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{subtext}</p>}
      </div>
    </div>
  );

  const ColumnCard = ({ col }) => {
    const hasTopValues = col.top_values && Object.keys(col.top_values).length > 0;
    const maxCount = hasTopValues ? Math.max(...Object.values(col.top_values)) : 1;
    return (
      <div className={`p-5 rounded-2xl border transition-all flex flex-col justify-between animate-fade-in-up ${darkMode
          ? 'bg-slate-900/50 border-slate-800 hover:border-indigo-500/30 hover:shadow-lg'
          : 'bg-white border-slate-200 hover:border-indigo-200 hover:shadow-md'
        }`}>
        <div>
          <div className="flex justify-between items-start mb-3">
            <h4 className={`font-bold truncate pr-2 text-xs ${darkMode ? 'text-slate-200' : 'text-slate-800'}`} title={col.name}>{col.name}</h4>
            <span className={`text-[8px] px-2 py-0.5 rounded-full font-bold uppercase border ${col.type === 'Numeric'
                ? darkMode ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-700 border-blue-100'
                : col.type === 'Date'
                  ? darkMode ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-amber-50 text-amber-700 border-amber-100'
                  : darkMode ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}>{col.type}</span>
          </div>
          <div className={`space-y-2 text-[11px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            <div className="flex justify-between items-center"><span>Missing</span><div className={`font-mono font-bold ${col.missing > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{col.missing}</div></div>
            <div className="flex justify-between items-center"><span>Unique</span><div className={`font-mono font-bold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{col.unique}</div></div>
          </div>
        </div>
        {hasTopValues ? (
          <div className={`mt-4 pt-3 border-t ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
            <p className={`text-[8px] mb-2 uppercase tracking-wider font-extrabold ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Top Frequencies</p>
            <div className="space-y-2">
              {Object.entries(col.top_values).map(([val, count], idx) => (
                <div key={idx} className={`flex items-center text-[10px] ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  <div className="w-16 truncate mr-2" title={val}>{val}</div>
                  <div className={`flex-1 h-1 rounded-full overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}><div className="h-full bg-indigo-500 rounded-full shadow-glow" style={{ width: `${(count / maxCount) * 100}%` }}></div></div>
                  <div className={`ml-2 font-mono text-[8px] w-6 text-right ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{count}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className={`pt-2 border-t mt-2 ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
            <p className={`text-[8px] mb-1 uppercase tracking-wider font-extrabold ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Data Sample</p>
            <p className={`font-mono text-[10px] truncate p-1.5 rounded border ${darkMode ? 'text-slate-400 bg-slate-950 border-slate-800' : 'text-slate-600 bg-slate-50 border-slate-200'
              }`}>{col.sample}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`${data ? 'h-screen overflow-hidden' : 'min-h-screen overflow-x-hidden'} font-sans transition-colors duration-350 flex flex-col md:flex-row relative ${darkMode
        ? 'bg-slate-950 text-slate-100 bg-grid-pattern'
        : 'bg-slate-50 text-slate-900'
      }`}>

      {/* Background blurs for design glow in dark mode */}
      {darkMode && (
        <>
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none"></div>
        </>
      )}

      {/* 🔒 Pipeline Configurations Modal (Glassmorphic) */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className={`rounded-3xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden animate-scale-up border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}>
            <div className={`p-5 border-b flex justify-between items-center bg-gradient-to-r ${darkMode ? 'from-indigo-950 to-slate-900 border-slate-800' : 'from-indigo-50 to-slate-100 border-slate-200'
              }`}>
              <div className="flex items-center space-x-2">
                <Sparkles className="text-indigo-400 animate-pulse-slow animate-spin-slow" size={16} />
                <h3 className={`font-bold text-sm ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>Pipeline Cleaning Configurations</h3>
              </div>
              <button onClick={() => setShowSettingsModal(false)} className={`text-slate-400 hover:text-slate-200 transition-colors p-1 rounded-full border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-200 border-slate-300 hover:text-slate-700'
                }`}>
                <X size={14} />
              </button>
            </div>
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {/* Imputation select */}
              <div className="space-y-2">
                <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">Missing Numbers Imputation</label>
                <p className="text-[11px] text-slate-400">Choose how to handle blank cells in numeric columns.</p>
                <select
                  value={imputeNumeric}
                  onChange={(e) => setImputeNumeric(e.target.value)}
                  className={`w-full text-xs rounded-xl p-2.5 outline-none font-bold border ${darkMode ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700 shadow-sm'
                    }`}
                >
                  <option value="median">Median (Recommended)</option>
                  <option value="mean">Mean</option>
                  <option value="mode">Mode (Most Frequent)</option>
                  <option value="zero">Fill with Zero</option>
                  <option value="remove">Remove Rows</option>
                </select>
              </div>

              {/* Anomaly Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">Anomaly Contamination</label>
                  <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${darkMode ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' : 'text-indigo-700 bg-indigo-50 border-indigo-200'
                    }`}>
                    {anomalyContamination === 0 ? 'Disabled' : `${(anomalyContamination * 100).toFixed(0)}%`}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">Proportion of outlier rows to drop using Isolation Forest.</p>
                <input
                  type="range"
                  min="0"
                  max="0.20"
                  step="0.01"
                  value={anomalyContamination}
                  onChange={(e) => setAnomalyContamination(parseFloat(e.target.value))}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              {/* Typo Correction */}
              <div className={`space-y-3 p-4 rounded-xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">Smart Typo Auto-Correction</label>
                    <p className="text-[11px] text-slate-400">Uses sequence similarity to merge spelling variants in text fields.</p>
                  </div>
                  <button
                    onClick={() => setRunTypoCorrection(!runTypoCorrection)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold uppercase transition-colors border ${runTypoCorrection
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                        : 'bg-slate-200 text-slate-400 border-slate-300'
                      }`}
                  >
                    {runTypoCorrection ? 'Enabled' : 'Disabled'}
                  </button>
                </div>

                {runTypoCorrection && (
                  <div className={`pt-2 border-t space-y-2 animate-fade-in-up ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                    <div className="flex justify-between items-center">
                      <label className="block text-xs font-bold text-slate-400">Similarity Threshold</label>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${darkMode ? 'text-slate-300 bg-slate-800' : 'text-slate-600 bg-slate-200'
                        }`}>
                        {(typoThreshold * 100).toFixed(0)}% Match
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.50"
                      max="0.99"
                      step="0.05"
                      value={typoThreshold}
                      onChange={(e) => setTypoThreshold(parseFloat(e.target.value))}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                )}
              </div>

              {/* Parsing toggles */}
              <div className="grid grid-cols-2 gap-4">
                <div className={`flex flex-col justify-between p-3 rounded-xl border space-y-2 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}>
                  <div>
                    <span className="block text-xs font-bold">Smart Numeric</span>
                    <span className="block text-[10px] text-slate-400 leading-tight">Parse currencies & metrics.</span>
                  </div>
                  <button
                    onClick={() => setRunNumericParsing(!runNumericParsing)}
                    className={`w-full py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors border ${runNumericParsing
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-slate-200 text-slate-400 border-slate-300'
                      }`}
                  >
                    {runNumericParsing ? 'On' : 'Off'}
                  </button>
                </div>

                <div className={`flex flex-col justify-between p-3 rounded-xl border space-y-2 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}>
                  <div>
                    <span className="block text-xs font-bold">Smart Dates</span>
                    <span className="block text-[10px] text-slate-400 leading-tight">Standardize date columns.</span>
                  </div>
                  <button
                    onClick={() => setRunDateFormatting(!runDateFormatting)}
                    className={`w-full py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors border ${runDateFormatting
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-slate-200 text-slate-400 border-slate-300'
                      }`}
                  >
                    {runDateFormatting ? 'On' : 'Off'}
                  </button>
                </div>
              </div>
            </div>
            <div className={`p-4 border-t flex justify-between gap-3 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
              <button
                onClick={() => {
                  setImputeNumeric('median');
                  setAnomalyContamination(0.05);
                  setRunTypoCorrection(true);
                  setTypoThreshold(0.75);
                  setRunDateFormatting(true);
                  setRunNumericParsing(true);
                }}
                className={`px-4 py-2 text-xs font-bold uppercase rounded-xl transition-colors border ${darkMode ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300' : 'bg-slate-200 hover:bg-slate-305 border-slate-305 text-slate-600'
                  }`}
              >
                Reset
              </button>
              <button
                onClick={() => {
                  setShowSettingsModal(false);
                  if (data && file) {
                    handleUpload();
                  }
                }}
                className={`px-6 py-2 text-xs font-bold uppercase rounded-xl shadow-lg transition-colors border ${darkMode ? 'bg-indigo-600 hover:bg-indigo-700 border-indigo-500 text-white' : 'bg-indigo-600 hover:bg-indigo-700 border-indigo-500 text-white'
                  }`}
              >
                {data && file ? "Apply & Re-Run" : "Save Settings"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 LANDING VIEW (No Dataset Processed Yet) */}
      {!data && (
        <div className="min-h-screen w-full flex flex-col justify-between z-10 transition-colors duration-300">
          <header className={`backdrop-blur border-b px-6 py-4 flex justify-between items-center sticky top-0 z-10 ${darkMode ? 'bg-slate-950/70 border-slate-900' : 'bg-white/80 border-slate-200'
            }`}>
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-indigo-500 to-purple-500 p-2.5 rounded-xl shadow-lg text-white">
                <Database size={18} />
              </div>
              <div className="leading-tight">
                <span className="block text-base font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-500">InfoPulse <span className={darkMode ? 'text-white' : 'text-slate-800'}>AI</span></span>
                <span className="block text-[8px] text-slate-500 font-bold tracking-widest uppercase">Data Standardizer Studio</span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`p-2 rounded-xl border transition-colors ${darkMode
                    ? 'bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800'
                    : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                  }`}
                title="Toggle UI Theme"
              >
                {darkMode ? <Sun size={15} /> : <Moon size={15} />}
              </button>
              <button
                onClick={() => setShowSettingsModal(true)}
                className={`flex items-center space-x-2 px-4 py-2 border rounded-xl text-xs font-bold transition-colors shadow-sm ${darkMode
                    ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
              >
                <Filter size={14} />
                <span>Pipeline Configs</span>
              </button>
            </div>
          </header>

          <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-12 flex flex-col justify-center">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

              {/* Left Column: Brand Text & Pipeline Features Info Grid */}
              <div className="lg:col-span-6 space-y-8 text-left animate-fade-in-up">
                <div className="space-y-4">
                  <div className={`inline-flex items-center space-x-2 px-3 py-1 text-[10px] font-bold rounded-full shadow-sm border ${darkMode ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-indigo-50 border-indigo-100 text-indigo-700'
                    }`}>
                    <Sparkles size={11} className="animate-pulse" />
                    <span>CleanEngine 2.0 Active</span>
                  </div>
                  <h1 className={`text-4xl md:text-6xl font-extrabold tracking-tight leading-tight ${darkMode ? 'text-white' : 'text-slate-900'
                    }`}>
                    Clean Data.<br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">Zero Code.</span>
                  </h1>
                  <p className={`text-xs md:text-sm leading-relaxed max-w-xl ${darkMode ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                    Standardize, profile, clean, and structure raw CSV or Excel datasets instantly. Customize parameters, view interactive reports, and export clean database scripts in seconds.
                  </p>
                </div>

                {/* Grid of features */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { title: 'PII Redaction', text: 'Masks email and phone numbers to safeguard records.', icon: ShieldCheck },
                    { title: 'Isolation Forest', text: 'Drops multi-dimensional outliers from final outputs.', icon: AlertTriangle },
                    { title: 'Typo Correction', text: 'Standardizes spelling differences in text fields.', icon: Activity },
                    { title: 'Numeric Imputer', text: 'Imputes numeric blanks with median/mean metrics.', icon: RefreshCw }
                  ].map((feat, i) => (
                    <div key={i} className={`p-4 rounded-2xl border transition-all hover:shadow-md ${darkMode ? 'bg-slate-900/40 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200'
                      }`}>
                      <div className="flex items-center space-x-2 text-indigo-500 font-extrabold text-xs mb-1">
                        <feat.icon size={15} />
                        <span>{feat.title}</span>
                      </div>
                      <p className={`text-[10px] leading-relaxed ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{feat.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Processing / Drag Upload Card */}
              <div className="lg:col-span-6 w-full animate-fade-in-up">
                <div className="relative group max-w-xl mx-auto">
                  <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-3xl blur opacity-20 group-hover:opacity-35 transition duration-1000"></div>
                  <div className={`relative p-6 md:p-8 rounded-3xl shadow-2xl border space-y-6 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                    }`}>

                    {!file ? (
                      /* Drag Zone */
                      <div
                        className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center space-y-4 hover:border-indigo-500/55 transition-all cursor-pointer relative overflow-hidden group/zone ${darkMode ? 'border-slate-800 bg-slate-950/40 hover:bg-indigo-900/20' : 'border-slate-300 bg-slate-50/50 hover:bg-indigo-50/20'
                          }`}
                        onClick={() => document.getElementById('file-upload').click()}
                      >
                        <input id="file-upload" type="file" onChange={(e) => setFile(e.target.files[0])} accept=".csv,.xlsx" className="hidden" />
                        <div className={`p-4 rounded-full border transition-transform mb-2 shadow-inner ${darkMode ? 'bg-slate-900 border-slate-800 text-indigo-400 group-hover/zone:scale-110' : 'bg-white border-slate-200 text-indigo-500 group-hover/zone:scale-110'
                          }`}><Upload size={24} /></div>
                        <div className="text-center">
                          <p className={`text-sm font-bold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Click to select or drag file</p>
                          <p className="text-xs text-slate-500 mt-1">Supports Microsoft Excel & CSV datasets</p>
                        </div>
                      </div>
                    ) : (
                      /* File Loaded State Block */
                      <div className={`p-5 rounded-2xl text-left space-y-4 border animate-scale-up ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
                        }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`p-2.5 rounded-xl border ${darkMode ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-indigo-50 text-indigo-600 border-indigo-200'
                              }`}><FileSpreadsheet size={20} /></div>
                            <div>
                              <p className={`text-xs font-bold truncate max-w-[180px] ${darkMode ? 'text-slate-200' : 'text-slate-800'}`} title={file.name}>{file.name}</p>
                              <p className="text-[10px] text-slate-500 font-mono font-bold">{(file.size / 1024).toFixed(2)} KB</p>
                            </div>
                          </div>
                          <button onClick={() => setFile(null)} className={`transition-colors p-1 rounded-full border ${darkMode ? 'text-slate-500 hover:text-rose-400 bg-slate-900 border-slate-800' : 'text-slate-400 hover:text-rose-600 bg-white border-slate-200'
                            }`} title="Remove File">
                            <X size={14} />
                          </button>
                        </div>

                        {/* Pipeline configurations preview card */}
                        <div className={`pt-3 border-t space-y-2 text-xs ${darkMode ? 'border-slate-800/80' : 'border-slate-200'}`}>
                          <p className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider font-mono">Cleaning Settings Preview</p>
                          <div className="grid grid-cols-2 gap-2 text-slate-400 font-medium text-[11px]">
                            {[
                              { label: 'Imputation', val: imputeNumeric },
                              { label: 'Outliers Contam.', val: anomalyContamination === 0 ? 'Off' : `${(anomalyContamination * 100).toFixed(0)}%` },
                              { label: 'Smart Typos', val: runTypoCorrection ? `${(typoThreshold * 100).toFixed(0)}%` : 'Off' },
                              { label: 'PII Masking', val: maskPii ? 'Active' : 'Disabled', highlight: maskPii }
                            ].map((cfg, idx) => (
                              <div key={idx} className={`flex justify-between items-center p-2 rounded-lg border ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-100 text-slate-700'
                                }`}>
                                <span className="text-[9px] text-slate-500">{cfg.label}</span>
                                <span className={`font-bold capitalize ${cfg.highlight ? 'text-emerald-500 font-extrabold' : ''}`}>{cfg.val}</span>
                              </div>
                            ))}
                          </div>
                          <button onClick={() => setShowSettingsModal(true)} className="w-full mt-2 text-center text-indigo-400 hover:text-indigo-300 font-bold text-[9px] uppercase tracking-wider block hover:underline">
                            Change Configuration Parameters
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      <button
                        onClick={() => setMaskPii(!maskPii)}
                        className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all border w-full sm:w-auto justify-center ${maskPii
                            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                            : 'bg-slate-950 border-slate-800 text-slate-500 hover:bg-slate-800/50'
                          }`}
                      >
                        <ShieldCheck size={16} />
                        <span>{maskPii ? "PII Masking On" : "PII Masking Off"}</span>
                      </button>
                      <button
                        onClick={handleUpload}
                        disabled={loading || !file}
                        className={`w-full sm:w-auto text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg disabled:opacity-50 disabled:shadow-none flex items-center justify-center border ${darkMode ? 'bg-indigo-600 hover:bg-indigo-700 border-indigo-500' : 'bg-indigo-600 hover:bg-indigo-700 border-indigo-500'
                          }`}
                      >
                        {loading ? <Loader2 className="animate-spin mr-2" size={18} /> : <ArrowRight className="mr-2" size={18} />}
                        {loading ? "Running AI Pipeline..." : "Process Dataset"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </main>

          <footer className={`py-4 border-t text-center text-xs text-slate-500 ${darkMode ? 'border-slate-900 bg-slate-950' : 'border-slate-200 bg-slate-100/50'
            }`}>
            Powered by InfoPulse AI Engine suite
          </footer>
        </div>
      )}

      {/* 📊 CORE DASHBOARD VIEW (With Obsidian Navigation Sidebar) */}
      {data && (
        <div className="flex flex-col md:flex-row w-full h-screen overflow-hidden z-10 transition-colors duration-300">

          {/* 1. Left Sidebar Panel */}
          <aside className={`w-full md:w-64 flex flex-col justify-between border-r shrink-0 h-auto md:h-full ${darkMode ? 'bg-slate-950 border-slate-900/60 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
            }`}>
            <div className="flex flex-col">
              {/* Sidebar Header Brand */}
              <div className={`p-6 border-b flex items-center space-x-3 cursor-pointer ${darkMode ? 'border-slate-900 hover:bg-slate-900/30' : 'border-slate-200 hover:bg-slate-200/50'
                }`} onClick={handleReset}>
                <div className="bg-gradient-to-br from-indigo-500 to-purple-550 p-2.5 rounded-lg text-white">
                  <Database size={16} />
                </div>
                <div>
                  <span className={`block text-sm font-bold tracking-wide ${darkMode ? 'text-white' : 'text-slate-800'}`}>InfoPulse <span className="font-extrabold text-indigo-500">AI</span></span>
                  <span className="block text-[8px] text-slate-500 font-bold uppercase tracking-widest">Workspace studio</span>
                </div>
              </div>

              {/* Sidebar Navigation Tabs */}
              <nav className="p-4 space-y-1.5 flex-1">
                {[
                  { id: 'dashboard', label: 'Overview Dashboard', icon: LayoutDashboard },
                  { id: 'viewer', label: 'Data Comparer', icon: Table },
                  { id: 'profiler', label: 'Metadata Profiler', icon: Activity },
                  { id: 'charts', label: 'Visual Studio', icon: BarChart3 },
                  { id: 'sql', label: 'SQL Schema Export', icon: Code }
                ].map(item => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold tracking-wide transition-all border ${isActive
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                          : darkMode
                            ? 'border-transparent hover:bg-slate-900/50 hover:text-white'
                            : 'border-transparent hover:bg-slate-200/50 hover:text-slate-900'
                        }`}
                    >
                      <item.icon size={15} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Sidebar Bottom Controls & Toggle */}
            <div className={`p-4 border-t space-y-2 ${darkMode ? 'border-slate-900 bg-slate-950/70' : 'border-slate-200 bg-slate-50/60'
              }`}>
              {/* Sun/Moon Theme Toggler */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold tracking-wide transition-colors border ${darkMode
                    ? 'bg-slate-900 hover:bg-slate-800 text-amber-400 border-slate-800'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-sm'
                  }`}
              >
                {darkMode ? <Sun size={13} /> : <Moon size={13} />}
                <span>{darkMode ? "Light Theme" : "Dark Theme"}</span>
              </button>

              <button
                onClick={() => setShowSettingsModal(true)}
                className={`w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold tracking-wide transition-colors border ${darkMode ? 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-800' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-sm'
                  }`}
              >
                <Filter size={13} />
                <span>Change Settings</span>
              </button>

              <button
                onClick={handleReset}
                className={`w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold tracking-wide transition-colors border ${darkMode ? 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-800' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-sm'
                  }`}
              >
                <RefreshCw size={13} />
                <span>Upload New Dataset</span>
              </button>

              <div className="pt-2 flex items-center justify-between text-[9px] text-slate-500 px-1 font-bold">
                <span>Core Engine</span>
                <span className="flex items-center space-x-1.5 text-emerald-500 font-extrabold">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-glow"></span>
                  <span>Active</span>
                </span>
              </div>
            </div>
          </aside>

          {/* 2. Main Workspace (Right Panel) */}
          <main className={`flex-1 flex flex-col h-full overflow-hidden ${darkMode ? 'bg-slate-950/20' : 'bg-slate-50/20'
            }`}>

            {/* Top Workspace Header */}
            <header className={`border-b px-6 py-4 flex flex-col lg:flex-row justify-between items-center gap-4 shrink-0 ${darkMode ? 'bg-slate-950 border-slate-900' : 'bg-white border-slate-200'
              }`}>
              <div>
                <h2 className={`text-lg font-extrabold capitalize ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                  {activeTab === 'sql' ? 'SQL Schema Export' : activeTab === 'viewer' ? 'Comparative Table' : activeTab === 'charts' ? 'Visual Insights Studio' : 'Overview Dashboard'}
                </h2>
                <div className="flex items-center space-x-2 mt-1">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${darkMode ? 'bg-slate-900 text-slate-400 border-slate-800' : 'bg-slate-200 text-slate-650 border-slate-300'
                    }`}>{file?.name}</span>
                  <span className="text-slate-500 text-xs">•</span>
                  <span className="text-[9px] text-slate-500 font-bold font-mono">{data.insights.rows_original} rows original</span>
                </div>
              </div>

              {/* Center Ask AI search box */}
              <div className="relative w-full lg:w-96 group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  {aiLoading ? <Loader2 size={13} className="text-indigo-400 animate-spin" /> : <Sparkles size={13} className="text-indigo-400" />}
                </div>
                <input
                  type="text"
                  placeholder='Ask AI filter (e.g. "salaries above 50000")'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleAskAI}
                  className={`block w-full pl-8 pr-8 py-2 border rounded-xl text-xs font-semibold tracking-wide transition-all outline-none ${darkMode
                      ? 'border-slate-800 bg-slate-900/60 text-slate-200 focus:bg-slate-900 placeholder-slate-500'
                      : 'border-slate-200 bg-white text-slate-800 focus:bg-slate-50 placeholder-slate-400 shadow-sm'
                    }`}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-350">
                    <X size={12} />
                  </button>
                )}
                {aiError && (
                  <div className={`absolute top-full left-0 right-0 mt-1.5 p-2 text-white text-[10px] font-semibold rounded-lg shadow-lg z-25 text-center border animate-fade-in-up ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-950 border-slate-800'
                    }`}>
                    {aiError}
                  </div>
                )}
              </div>
            </header>

            {/* Content Container */}
            <div className="p-6 md:p-8 flex-1 overflow-y-auto min-h-0 custom-scrollbar">

              {/* PAGE 1: CENTRALIZED OVERVIEW DASHBOARD */}
              {activeTab === 'dashboard' && (
                <div className="space-y-6 animate-scale-up">
                  {/* Hero card gradient standard */}
                  <div className={`p-6 md:p-8 rounded-3xl border shadow-xl relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-6 ${darkMode
                      ? 'bg-gradient-to-br from-indigo-950/80 via-slate-900/90 to-slate-950 border-indigo-500/10'
                      : 'bg-gradient-to-br from-indigo-50/70 via-indigo-50/30 to-slate-100 border-indigo-100'
                    }`}>
                    <div className="space-y-2 z-10 text-center md:text-left">
                      <span className={`text-[9px] border px-2.5 py-0.5 rounded-full font-extrabold uppercase tracking-widest font-mono ${darkMode ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-indigo-100 border-indigo-200 text-indigo-700'
                        }`}>Telemetry Report</span>
                      <h3 className={`text-xl font-extrabold tracking-tight ${darkMode ? 'text-white' : 'text-slate-800'}`}>Dataset Standardized Successfully</h3>
                      <p className={`text-xs max-w-xl leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                        InfoPulse pipeline execution completed. Evaluated schema validations, imputed numeric gaps, masked PII credentials, and isolated multidimensional outliers.
                      </p>
                    </div>
                    {/* Health index card */}
                    <div className={`p-4 rounded-2xl border flex flex-col justify-center items-center shrink-0 w-full md:w-56 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                      }`}>
                      <h4 className={`text-[8px] font-bold uppercase tracking-widest mb-2 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Quality Index</h4>
                      <GaugeChart score={data.insights.quality_score} />
                    </div>
                  </div>

                  {/* 4 Stats Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard title="Processed Records" value={data.insights.rows_cleaned} subtext={`Retained ${((data.insights.rows_cleaned / data.insights.rows_original) * 100).toFixed(0)}% of rows`} icon={CheckCircle} color={darkMode ? { bg: 'bg-emerald-500/10 border border-emerald-500/20', text: 'text-emerald-400' } : { bg: 'bg-emerald-50 border border-emerald-100', text: 'text-emerald-700' }} />
                    <StatCard title="Duplicates Purged" value={data.insights.duplicates_removed} subtext="Deduplicated identical records" icon={Copy} color={darkMode ? { bg: 'bg-indigo-500/10 border border-indigo-500/20', text: 'text-indigo-400' } : { bg: 'bg-indigo-50 border border-indigo-100', text: 'text-indigo-700' }} />
                    <StatCard title="Outliers Isolated" value={data.insights.anomalies_detected} subtext="Isolation Forest outliers" icon={AlertTriangle} color={darkMode ? { bg: 'bg-amber-500/10 border border-amber-500/20', text: 'text-amber-400' } : { bg: 'bg-amber-50 border border-amber-100', text: 'text-amber-700' }} />
                    <StatCard title="PII Redacted" value={data.insights.pii_masked} subtext="Masked emails & phones" icon={UserX} color={darkMode ? { bg: 'bg-rose-500/10 border border-rose-500/20', text: 'text-rose-450' } : { bg: 'bg-rose-50 border border-rose-100', text: 'text-rose-700' }} />
                  </div>

                  {/* Dynamic Summary Block & Logs */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Card: Summary & Checklist */}
                    <div className={`p-6 rounded-2xl shadow-md border flex flex-col justify-between space-y-6 ${darkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'
                      }`}>
                      <div className="space-y-4">
                        <div className={`flex items-center space-x-2 border-b pb-3 ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                          <div className={`p-1.5 border rounded-lg ${darkMode ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-indigo-50 border-indigo-100 text-indigo-700'
                            }`}><FileText size={18} /></div>
                          <h3 className={`text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>Executive Summary</h3>
                        </div>
                        <p className={`text-xs leading-relaxed font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{data.insights.summary}</p>
                      </div>

                      {/* Interactive Pipeline Checklist */}
                      <div className="space-y-3">
                        <h4 className={`text-[10px] font-extrabold uppercase tracking-wider ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Pipeline Rules Executed</h4>
                        <div className="space-y-2 text-xs">
                          <div className="flex items-center space-x-2">
                            <span className="text-emerald-500">✓</span>
                            <span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>Deduplication: {data.insights.duplicates_removed > 0 ? `Purged ${data.insights.duplicates_removed} duplicates` : 'Dataset already deduplicated'}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-emerald-500">✓</span>
                            <span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>PII Shield: {data.insights.pii_masked > 0 ? `Masked ${data.insights.pii_masked} credentials` : 'Verified no raw credentials leaked'}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-emerald-500">✓</span>
                            <span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>Anomaly Detector: {data.insights.anomalies_detected > 0 ? `Dropped ${data.insights.anomalies_detected} outliers` : 'Scan cleared, no outliers flagged'}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-emerald-500">✓</span>
                            <span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>Missing Numbers: Imputed gaps using {imputeNumeric} logic</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Middle Card: Outliers Flagged Feed & Recommendations */}
                    <div className={`p-6 rounded-2xl shadow-md border flex flex-col justify-between space-y-6 ${darkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'
                      }`}>
                      <div className="space-y-4 flex-1">
                        <div className={`flex items-center space-x-2 border-b pb-3 ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                          <div className={`p-1.5 border rounded-lg ${darkMode ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-indigo-50 border-indigo-100 text-indigo-700'
                            }`}><AlertTriangle size={18} /></div>
                          <h3 className={`text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>AI Flagged Outliers Feed</h3>
                        </div>

                        {data.insights.anomaly_list && data.insights.anomaly_list.length > 0 ? (
                          <div className="space-y-2 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
                            {data.insights.anomaly_list.map((anom, idx) => (
                              <div key={idx} className={`p-2.5 rounded-xl border text-[11px] font-medium leading-relaxed ${darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                                }`}>
                                <div className="flex justify-between items-center mb-1 select-none">
                                  <span className="font-bold text-[9px] uppercase tracking-wider text-rose-500 font-mono">Row #{anom.row_index} Outlier</span>
                                  <span className={`text-[8px] font-mono px-1.5 rounded-full ${darkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'}`}>ML Flagged</span>
                                </div>
                                <div className="flex flex-wrap gap-x-3 text-slate-500 font-mono text-[10px]">
                                  {Object.entries(anom.columns).map(([col, val]) => (
                                    <span key={col} className="truncate max-w-[120px]">{col}: <strong className={darkMode ? 'text-slate-350' : 'text-slate-800'}>{val}</strong></span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center italic text-slate-500 text-xs py-8 bg-slate-950/20 rounded-xl border border-dashed border-slate-800">
                            No isolation forest anomalies flagged.
                          </div>
                        )}
                      </div>

                      {/* Smart Recommendations */}
                      <div className={`p-3 rounded-xl border text-xs leading-relaxed flex items-start space-x-2 ${darkMode ? 'bg-indigo-500/5 border-indigo-500/10 text-indigo-300' : 'bg-indigo-50/50 border-indigo-100 text-indigo-900'
                        }`}>
                        <Sparkles size={16} className="shrink-0 text-indigo-500 animate-pulse mt-0.5" />
                        <div>
                          <strong className="block text-[10px] uppercase font-bold tracking-wider mb-0.5 font-sans">AI Engine Suggestion:</strong>
                          {data.insights.anomalies_detected > data.insights.rows_original * 0.1 ? (
                            <span>Anomaly rate is high ({((data.insights.anomalies_detected / data.insights.rows_original) * 100).toFixed(0)}%). Consider reducing contamination rate slider in settings to preserve more raw variance.</span>
                          ) : data.insights.duplicates_removed > data.insights.rows_original * 0.15 ? (
                            <span>High duplicate density detected. Review your client-side data capture pipeline to avoid double-posting events.</span>
                          ) : (
                            <span>Schema quality index is stable. Imputation complete. Dialect SQL export is ready for ingestion.</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Card: Pie Chart & Logs */}
                    <div className={`p-6 rounded-2xl border shadow-md flex flex-col space-y-6 ${darkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'
                      }`}>
                      <div className="flex flex-col flex-1">
                        <div className={`border-b pb-3 mb-2 ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                          <h3 className={`text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>Row Purge Statistics</h3>
                        </div>
                        <div className="w-full h-[180px] flex items-center justify-center">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={[
                                  { name: 'Clean Rows', value: data.insights.rows_cleaned },
                                  { name: 'Duplicate Rows', value: data.insights.duplicates_removed },
                                  { name: 'Anomalous Outliers', value: data.insights.anomalies_detected }
                                ]}
                                cx="50%"
                                cy="50%"
                                innerRadius={42}
                                outerRadius={55}
                                paddingAngle={4}
                                dataKey="value"
                              >
                                {COLORS.map((color, index) => <Cell key={`cell-${index}`} fill={color} />)}
                              </Pie>
                              <Tooltip contentStyle={
                                darkMode
                                  ? { background: '#090d16', border: '1px solid #1e293b', borderRadius: '12px', fontSize: 10, color: '#f8fafc' }
                                  : { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: 10, color: '#0f172a' }
                              } />
                              <Legend verticalAlign="bottom" iconType="circle" iconSize={6} wrapperStyle={{ fontSize: 8, fontWeight: 'bold' }} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Transformation Logs */}
                      <div className="space-y-2">
                        <h4 className={`text-[10px] font-extrabold uppercase tracking-wider ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Pipeline Terminal Logs</h4>
                        <div className={`rounded-xl p-3 h-28 overflow-y-auto text-[9px] font-mono space-y-1.5 border custom-scrollbar select-all ${darkMode ? 'bg-slate-950 text-slate-400 border-slate-800' : 'bg-slate-950 text-slate-400 border-slate-900'
                          }`}>
                          {data.insights.logs.map((log, i) => (
                            <div key={i} className="flex items-start space-x-1.5">
                              <span className="text-indigo-400 select-none">›</span>
                              <span>{log}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* PAGE 2: DATA TABLE COMPARER */}
              {activeTab === 'viewer' && (
                <div className="space-y-4 animate-scale-up flex flex-col h-full">
                  {/* Summary Bar & Layout Toggle */}
                  <div className={`p-4 border rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                    }`}>
                    <div className="flex flex-wrap items-center gap-4 text-xs font-extrabold">
                      <span className="text-slate-500 uppercase text-[9px] tracking-wider pr-1">Comparer Summary:</span>
                      <span className={`px-2 py-0.5 rounded ${darkMode ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-700'}`}>
                        {changesSummary?.cellModifications || 0} Cells Patched
                      </span>
                      <span className={`px-2 py-0.5 rounded ${darkMode ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-700'}`}>
                        {changesSummary?.outliersRemoved || 0} Outliers Purged
                      </span>
                      <span className={`px-2 py-0.5 rounded ${darkMode ? 'bg-rose-500/10 text-rose-400' : 'bg-rose-50 text-rose-700'}`}>
                        {changesSummary?.piiMasked || 0} PII Masked
                      </span>
                    </div>

                    <div className={`flex items-center space-x-2 p-1 rounded-xl border ${darkMode ? 'bg-slate-950/20 border-slate-800/10' : 'bg-slate-100 border-slate-200 shadow-sm'
                      }`}>
                      <button
                        onClick={() => setViewerLayout('split')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors ${viewerLayout === 'split'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : darkMode ? 'text-slate-500 hover:text-slate-350' : 'text-slate-600 hover:text-slate-900'
                          }`}
                      >
                        Split View
                      </button>
                      <button
                        onClick={() => setViewerLayout('focus')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors ${viewerLayout === 'focus'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : darkMode ? 'text-slate-500 hover:text-slate-350' : 'text-slate-600 hover:text-slate-900'
                          }`}
                      >
                        Focus View
                      </button>
                    </div>
                  </div>

                  {viewerLayout === 'split' ? (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 h-[500px]">
                      <TableWithDiffHighlight data={data.preview_original} title="Original Raw Dataset Preview (Top 50 rows)" color="text-rose-600" />
                      <TableWithDiffHighlight data={filteredData} origData={data.preview_original} title={searchQuery ? "Patched Cleaned Dataset Preview" : "Patched Cleaned Dataset Preview (Green = Patched)"} color="text-emerald-500" />
                    </div>
                  ) : (
                    /* Focus view tab toggle */
                    <div className="space-y-3 flex-1 flex flex-col h-[500px]">
                      <div className="flex justify-start space-x-2">
                        <button
                          onClick={() => setViewerTab('cleaned')}
                          className={`px-4 py-2 border text-xs font-bold uppercase rounded-xl transition-all ${viewerTab === 'cleaned'
                              ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                              : darkMode ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200' : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
                            }`}
                        >
                          Cleaned Standardized Data
                        </button>
                        <button
                          onClick={() => setViewerTab('original')}
                          className={`px-4 py-2 border text-xs font-bold uppercase rounded-xl transition-all ${viewerTab === 'original'
                              ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                              : darkMode ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200' : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
                            }`}
                        >
                          Original Raw Input Data
                        </button>
                      </div>
                      <div className="flex-1 min-h-0">
                        {viewerTab === 'cleaned' ? (
                          <TableWithDiffHighlight data={filteredData} origData={data.preview_original} title="Cleaned Standardized Dataset Focus View (Highlighted Cells = Patched)" color="text-emerald-550" />
                        ) : (
                          <TableWithDiffHighlight data={data.preview_original} title="Original Raw Input Dataset Focus View" color="text-rose-600" />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* PAGE 3: METADATA PROFILER */}
              {activeTab === 'profiler' && (
                <div className="space-y-6 animate-scale-up">
                  {/* Schema Summary Header Grid */}
                  <div className={`p-5 border rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                    }`}>
                    <div>
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Database Schema Summary</h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">Statistical distributions and data typing summary.</p>
                    </div>

                    <div className="flex items-center space-x-6 text-xs font-mono font-bold">
                      <div className="text-center"><span className={`block text-[9px] uppercase font-sans ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Total</span><span className="block text-lg text-indigo-500">{data.insights.column_stats.length}</span></div>
                      <div className="text-center"><span className={`block text-[9px] uppercase font-sans ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Numeric</span><span className="block text-lg text-blue-500">{data.insights.column_stats.filter(c => c.type === 'Numeric').length}</span></div>
                      <div className="text-center"><span className={`block text-[9px] uppercase font-sans ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Date/Time</span><span className="block text-lg text-amber-500">{data.insights.column_stats.filter(c => c.type === 'Date').length}</span></div>
                      <div className="text-center"><span className={`block text-[9px] uppercase font-sans ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Text/Obj</span><span className="block text-lg text-emerald-500">{data.insights.column_stats.filter(c => c.type === 'Text').length}</span></div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-slate-550 text-[10px] uppercase font-extrabold tracking-wider">Sort Columns:</span>
                      <select
                        value={profileSort}
                        onChange={(e) => setProfileSort(e.target.value)}
                        className={`border text-xs rounded-xl p-2 outline-none font-bold ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-300' : 'border-slate-200 bg-white text-slate-700 shadow-sm'
                          }`}
                      >
                        <option value="name">Sort by Name</option>
                        <option value="missing">Sort by Missing</option>
                        <option value="unique">Sort by Uniques</option>
                        <option value="type">Sort by Type</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {sortedColumnStats.map((col, i) => (
                      <ColumnCard key={i} col={col} />
                    ))}
                  </div>
                </div>
              )}

              {/* PAGE 4: VISUAL ANALYTICS STUDIO */}
              {activeTab === 'charts' && (
                <div className="space-y-6 animate-scale-up">
                  <div className={`p-6 rounded-2xl border shadow-md ${darkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'
                    }`}>
                    <div className={`flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 border-b pb-4 ${darkMode ? 'border-slate-800' : 'border-slate-100'
                      }`}>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider">Visual Distribution Plots</h3>
                        <p className="text-slate-500 text-[10px] mt-0.5">Observe distribution charts and metrics dependencies.</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 bg-slate-950/20 p-1.5 rounded-xl border border-slate-800/10">
                        {/* Theme select dropdown */}
                        <select
                          value={chartTheme}
                          onChange={(e) => setChartTheme(e.target.value)}
                          className={`border text-[11px] rounded-lg p-2 outline-none font-bold ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700 shadow-sm'
                            }`}
                          title="Chart Palette"
                        >
                          <option value="indigo">Indigo Theme</option>
                          <option value="emerald">Emerald Theme</option>
                          <option value="cyberpunk">Cyberpunk Theme</option>
                          <option value="sunset">Sunset Theme</option>
                        </select>

                        <select
                          value={selectedColumn}
                          onChange={(e) => setSelectedColumn(e.target.value)}
                          className={`border text-[11px] rounded-lg p-2 outline-none font-bold ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700 shadow-sm'
                            }`}
                        >
                          {data.insights.numeric_columns.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>

                        {chartType === 'Scatter' && (
                          <>
                            <span className="text-slate-500 text-xs font-bold px-1">vs</span>
                            <select
                              value={yColumn}
                              onChange={(e) => setYColumn(e.target.value)}
                              className={`border text-[11px] rounded-lg p-2 outline-none font-bold ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-305' : 'bg-white border-slate-200 text-slate-700 shadow-sm'
                                }`}
                            >
                              {data.insights.numeric_columns.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </>
                        )}
                        <div className="w-px bg-slate-800 my-1 h-5"></div>
                        <button onClick={() => setChartType('Bar')} className={`p-2 rounded-lg transition-all ${chartType === 'Bar' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`} title="Bar Chart"><BarChart3 size={15} /></button>
                        <button onClick={() => setChartType('Line')} className={`p-2 rounded-lg transition-all ${chartType === 'Line' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`} title="Line Chart"><LineIcon size={15} /></button>
                        <button onClick={() => setChartType('Scatter')} className={`p-2 rounded-lg transition-all ${chartType === 'Scatter' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`} title="Scatter Plot"><ScatterIcon size={15} /></button>
                      </div>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-6 items-stretch">
                      {/* Left: Responsive Chart container */}
                      <div className="flex-1 h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                          {chartType === 'Bar' ? (
                            <BarChart data={filteredData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? "#1e293b" : "#e2e8f0"} />
                              <XAxis dataKey="index" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 9 }} />
                              <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 9 }} />
                              <Tooltip cursor={{ fill: darkMode ? '#1e293b/20' : '#f1f5f9/40' }} contentStyle={
                                darkMode
                                  ? { background: '#090d16', border: '1px solid #1e293b', borderRadius: '12px', fontSize: 10, color: '#f8fafc' }
                                  : { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: 10, color: '#0f172a' }
                              } />
                              <Bar dataKey={selectedColumn} fill={THEME_COLORS[chartTheme]} radius={[4, 4, 0, 0]} />
                            </BarChart>
                          ) : chartType === 'Line' ? (
                            <LineChart data={filteredData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? "#1e293b" : "#e2e8f0"} />
                              <XAxis dataKey="index" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 9 }} />
                              <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 9 }} />
                              <Tooltip contentStyle={
                                darkMode
                                  ? { background: '#090d16', border: '1px solid #1e293b', borderRadius: '12px', fontSize: 10, color: '#f8fafc' }
                                  : { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: 10, color: '#0f172a' }
                              } />
                              <Line type="monotone" dataKey={selectedColumn} stroke={THEME_COLORS[chartTheme]} strokeWidth={2.5} dot={{ r: 0 }} activeDot={{ r: 4, fill: THEME_COLORS[chartTheme] }} />
                            </LineChart>
                          ) : (
                            <ScatterChart>
                              <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#1e293b" : "#e2e8f0"} />
                              <XAxis type="number" dataKey={selectedColumn} name={selectedColumn} tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
                              <YAxis type="number" dataKey={yColumn} name={yColumn} tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
                              <ZAxis type="number" range={[30, 150]} />
                              <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={
                                darkMode
                                  ? { background: '#090d16', border: '1px solid #1e293b', borderRadius: '12px', fontSize: 10, color: '#f8fafc' }
                                  : { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: 10, color: '#0f172a' }
                              } />
                              <Scatter name="Data" data={filteredData} fill={THEME_COLORS[chartTheme]}>
                                {filteredData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Scatter>
                            </ScatterChart>
                          )}
                        </ResponsiveContainer>
                      </div>

                      {/* Right: Math stats summary panel */}
                      {activeColumnStats && (
                        <div className={`p-4 rounded-xl border flex flex-col justify-center min-w-[200px] ${darkMode ? 'bg-slate-950 border-slate-800 text-slate-350 font-mono' : 'bg-slate-50 border-slate-200 text-slate-700 font-mono'
                          }`}>
                          <h4 className={`text-[9px] font-extrabold uppercase tracking-widest text-slate-500 border-b pb-2 mb-3 ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>Column Statistics</h4>
                          <div className="space-y-2 text-[11px]">
                            <div className="flex justify-between"><span>Samples</span><span className={`font-bold ${darkMode ? 'text-slate-200' : 'text-slate-900'}`}>{activeColumnStats.count}</span></div>
                            <div className="flex justify-between"><span>Min Value</span><span className={`font-bold ${darkMode ? 'text-slate-200' : 'text-slate-900'}`}>{activeColumnStats.min}</span></div>
                            <div className="flex justify-between"><span>Max Value</span><span className={`font-bold ${darkMode ? 'text-slate-200' : 'text-slate-900'}`}>{activeColumnStats.max}</span></div>
                            <div className="flex justify-between"><span>Average</span><span className={`font-bold ${darkMode ? 'text-slate-200' : 'text-slate-900'}`}>{activeColumnStats.mean}</span></div>
                            <div className="flex justify-between"><span>Median</span><span className={`font-bold ${darkMode ? 'text-slate-200' : 'text-slate-900'}`}>{activeColumnStats.median}</span></div>
                            <div className="flex justify-between"><span>Std Dev</span><span className={`font-bold ${darkMode ? 'text-slate-200' : 'text-slate-900'}`}>{activeColumnStats.stdDev}</span></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Correlation Heatmap Card */}
                  <div className={`p-6 rounded-2xl border shadow-md ${darkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'
                    }`}>
                    <div className={`border-b pb-3 mb-4 ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                      <h3 className="text-xs font-bold uppercase tracking-wider">Correlation Heatmap Matrix</h3>
                    </div>
                    <CorrelationHeatmap matrix={data.insights.correlation_matrix} />
                  </div>
                </div>
              )}

              {/* PAGE 5: SQL SCHEMA EXPORT TAB */}
              {activeTab === 'sql' && (
                <div className={`rounded-3xl shadow-xl overflow-hidden border flex flex-col h-[520px] animate-scale-up ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                  }`}>
                  <div className={`flex justify-between items-center px-6 py-3 border-b ${darkMode ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}>
                    <div className="flex items-center space-x-3">
                      <Database className="text-emerald-450 shadow-glow" size={16} />
                      {/* Dialect selector */}
                      <span className="text-[10px] text-slate-500 uppercase tracking-widest font-extrabold">Dialect:</span>
                      <select
                        value={sqlDialect}
                        onChange={(e) => setSqlDialect(e.target.value)}
                        className={`text-xs rounded-lg p-1.5 outline-none font-bold border ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700 shadow-sm'
                          }`}
                      >
                        <option value="postgres">PostgreSQL</option>
                        <option value="mysql">MySQL</option>
                        <option value="sqlite">SQLite</option>
                      </select>
                    </div>
                    <button
                      onClick={copyToClipboard}
                      className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold uppercase rounded-xl transition-all border ${darkMode ? 'bg-indigo-600 hover:bg-indigo-700 border-indigo-500 text-white' : 'bg-indigo-600 hover:bg-indigo-750 border-indigo-500 text-white shadow-indigo-100'
                        }`}
                    >
                      <Copy size={13} />
                      <span id="copy-btn-text">Copy Script</span>
                    </button>
                  </div>
                  <div className={`p-6 overflow-auto custom-scrollbar flex-1 bg-slate-950`}>
                    <pre className="font-mono text-xs text-slate-400 leading-relaxed select-all">{sqlDialectsCode}</pre>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Export Footer Banner */}
            <footer className={`border-t px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 shrink-0 ${darkMode ? 'bg-slate-950 border-slate-900' : 'bg-white border-slate-200'
              }`}>
              <div>
                <h3 className={`text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-slate-300' : 'text-slate-800'}`}>Export Standard Dataset</h3>
                <p className="text-slate-500 text-[11px] mt-0.5">Download your processed dataset in your format choice.</p>
              </div>
              <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
                <button
                  onClick={() => downloadFile('csv')}
                  className={`flex items-center space-x-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-colors border shadow-md ${darkMode ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-indigo-600 border-indigo-500 text-white'
                    }`}
                >
                  <FileSpreadsheet size={14} />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={() => downloadFile('json')}
                  className={`flex items-center space-x-1.5 px-4 py-2 border rounded-xl text-xs font-bold transition-colors ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'
                    }`}
                >
                  <Code size={14} />
                  <span>Export JSON</span>
                </button>
                <button
                  onClick={() => downloadFile('sql')}
                  className={`flex items-center space-x-1.5 px-4 py-2 border rounded-xl text-xs font-bold transition-colors ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'
                    }`}
                >
                  <Database size={14} />
                  <span>Export SQL</span>
                </button>
                <button
                  onClick={() => downloadFile('pdf')}
                  className={`flex items-center space-x-1.5 px-4 py-2 border rounded-xl text-xs font-bold transition-colors ${darkMode ? 'border-rose-500/20 text-rose-400 hover:bg-rose-500/10' : 'border-rose-300 text-rose-700 hover:bg-rose-50'
                    }`}
                >
                  <PdfIcon size={14} />
                  <span>Download Report</span>
                </button>
              </div>
            </footer>

            {/* AI Chatbot Floating Widget */}
            {!showChat && (
              <button
                onClick={() => setShowChat(true)}
                className={`fixed bottom-6 right-6 z-40 flex items-center space-x-2.5 px-6 py-4 rounded-2xl shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 group border bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 text-white border-white/20 font-extrabold text-xs uppercase tracking-wider shadow-indigo-500/20`}
                title="Chat with Dataset AI"
              >
                <MessageSquare className="w-4 h-4 text-white" />
                <span>Chat with your Data</span>
              </button>
            )}

            {showChat && (
              <div
                style={{ width: `${chatWidth}px` }}
                className={`fixed top-0 right-0 h-full max-w-full z-50 flex flex-col border-l shadow-2xl overflow-hidden transition-colors duration-300 ${darkMode
                    ? 'bg-slate-950 border-slate-800/80 text-slate-100 shadow-black'
                    : 'bg-white border-slate-200 text-slate-900 shadow-slate-300/30'
                  }`}
              >
                {/* Drag Handle for Resizing */}
                <div
                  onMouseDown={startResizing}
                  className={`absolute top-0 left-0 bottom-0 w-[5px] cursor-ew-resize hover:bg-indigo-500/40 transition-colors z-50 flex items-center justify-center group`}
                >
                  <div className="w-[1px] h-8 bg-slate-500/20 group-hover:bg-indigo-500/80 group-hover:scale-y-125 transition-all rounded" />
                </div>
                {/* Header */}
                <div className={`p-5 border-b flex justify-between items-center ${darkMode ? 'bg-slate-900 border-slate-800/80' : 'bg-indigo-50/40 border-indigo-100/50'
                  }`}>
                  <div className="flex items-center space-x-3">
                    <div className="bg-gradient-to-br from-indigo-500 to-purple-500 p-2.5 rounded-xl text-white shadow-md">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-extrabold tracking-wide">InfoPulse AI Assistant</span>
                        <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                      </div>
                      <span className="block text-[9px] text-indigo-500 dark:text-indigo-400 font-semibold uppercase tracking-wider font-mono">Online</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowChat(false)}
                    className={`p-2 rounded-full border transition-colors ${darkMode
                        ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-400 hover:text-slate-200'
                        : 'bg-indigo-50 hover:bg-indigo-100 border-indigo-100 text-indigo-650 hover:text-indigo-800'
                      }`}
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar min-h-0">
                  {chatMessages.map((msg, i) => {
                    const isBot = msg.role === 'model';
                    return (
                      <div key={i} className={`flex items-start space-x-2.5 ${isBot ? 'justify-start' : 'justify-end'} animate-fade-in-up`}>
                        {isBot && (
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${darkMode ? 'bg-slate-900 border border-slate-800 text-indigo-400' : 'bg-indigo-50 border border-indigo-100 text-indigo-600'
                            }`}>
                            <Sparkles size={13} />
                          </div>
                        )}
                        <div className={`flex flex-col ${isBot ? 'items-start' : 'items-end'} max-w-[80%]`}>
                          <div
                            className={`text-base px-4 py-3 shadow-sm leading-relaxed whitespace-pre-wrap font-normal ${isBot
                                ? darkMode
                                  ? 'bg-slate-900 border border-slate-850 text-slate-100 rounded-2xl rounded-tl-none shadow-inner'
                                  : 'bg-indigo-50/80 border border-indigo-100/80 text-indigo-950 rounded-2xl rounded-tl-none shadow-sm'
                                : 'bg-indigo-600 text-white rounded-2xl rounded-tr-none shadow-md'
                              }`}
                          >
                            {isBot ? parseMessageContent(msg.content) : msg.content}
                          </div>
                          <span className="text-[8px] font-bold text-slate-500 mt-1 uppercase px-1 font-mono tracking-wider">
                            {isBot ? 'AI Assistant' : 'You'}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {chatLoading && (
                    <div className="flex items-start space-x-2.5 justify-start animate-fade-in-up">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${darkMode ? 'bg-slate-900 border border-slate-800 text-indigo-400' : 'bg-indigo-50 border border-indigo-100 text-indigo-600'
                        }`}>
                        <Sparkles size={13} />
                      </div>
                      <div className="flex flex-col items-start max-w-[80%]">
                        <div className={`text-base px-4 py-3 rounded-2xl rounded-tl-none shadow-sm italic font-medium ${darkMode ? 'bg-slate-900 border border-slate-850 text-slate-350' : 'bg-indigo-50/80 border border-indigo-100/80 text-indigo-700'
                          }`}>
                          AI is generating response...
                        </div>
                        <span className="text-[8px] font-bold text-slate-505 mt-1 uppercase px-1 font-mono tracking-wider">
                          AI Copilot
                        </span>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Quick-question chips */}
                <div className={`px-5 py-3 border-t flex flex-wrap gap-2.5 ${darkMode ? 'border-slate-800 bg-slate-950/20' : 'border-indigo-100/80 bg-indigo-50/10'
                  }`}>
                  {[
                    { label: '📊 Summarize Dataset', text: 'Provide a brief summary and main insights of this dataset.' },
                    { label: '⚠️ View Outliers', text: 'What outlier anomalies were detected in the dataset and in which columns?' },
                    { label: '⚙️ Schema Info', text: 'Explain the columns, data types, and missing values profile of my dataset.' }
                  ].map((chip, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendChatMessage(chip.text)}
                      disabled={chatLoading}
                      className={`text-[11px] font-bold px-3.5 py-1.5 rounded-full border transition-all hover:scale-102 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none select-none ${darkMode
                          ? 'bg-slate-900 border-slate-800 text-indigo-300 hover:bg-slate-800 hover:text-indigo-400 hover:border-indigo-500/50 shadow-sm'
                          : 'bg-indigo-50/50 border-indigo-100 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 hover:border-indigo-200 shadow-sm'
                        }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                {/* Footer Input */}
                <div className={`p-4 border-t flex items-center space-x-2.5 ${darkMode ? 'bg-slate-900 border-slate-800/80' : 'bg-indigo-50/40 border-indigo-100/50'
                  }`}>
                  <input
                    type="text"
                    placeholder="Ask a question about your data..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSendChatMessage();
                    }}
                    disabled={chatLoading}
                    className={`flex-1 border rounded-xl px-4 py-3 text-sm font-semibold tracking-wide outline-none transition-all disabled:opacity-60 ${darkMode
                        ? 'border-slate-800 bg-slate-950 text-slate-100 placeholder-slate-500 focus:border-indigo-500/50 shadow-inner'
                        : 'border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:border-indigo-500 shadow-inner'
                      }`}
                  />
                  <button
                    onClick={() => handleSendChatMessage()}
                    disabled={!chatInput.trim() || chatLoading}
                    className={`p-3 rounded-xl border transition-all flex items-center justify-center disabled:opacity-50 disabled:scale-100 disabled:translate-y-0 ${darkMode
                        ? 'bg-indigo-600 hover:bg-indigo-700 border-indigo-500 text-white active:scale-95 shadow-md shadow-indigo-600/10'
                        : 'bg-indigo-600 hover:bg-indigo-700 border-indigo-500 text-white active:scale-95 shadow-md'
                      }`}
                    title="Send Message"
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}

export default App;