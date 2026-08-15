import React, { useState, useRef, useEffect } from 'react';
import { POOL, applyActivePreset } from '@/data/draftPool';
import {
  validateCustomRankings,
  applyCustomRankingsToPool,
  TEMPLATE_RANKINGS_CSV,
  type CustomRanking,
  getSavedPresets,
  savePresets,
  setActivePresetId,
  type CustomRankingPreset,
} from '@/utils/customRankings';
import styles from './CustomRankingsModal.module.css';

interface CustomRankingsModalProps {
  onClose: () => void;
  onApply: () => void;
}

type TabType = 'upload' | 'paste' | 'template';

export function CustomRankingsModal({ onClose, onApply }: CustomRankingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('upload');
  const [pasteText, setPasteText] = useState('');
  const [presetName, setPresetName] = useState('');
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [validation, setValidation] = useState<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    matchedCount: number;
    rankings?: CustomRanking[];
  } | null>(null);

  // Validate the text pasted in real-time or debounced
  useEffect(() => {
    if (activeTab !== 'paste') return;

    if (!pasteText.trim()) {
      setValidation(null);
      return;
    }

    if (!presetName) {
      setPresetName('Pasted Rankings ' + new Date().toLocaleDateString());
    }

    const valResult = validateCustomRankings(pasteText);
    if (!valResult.valid) {
      setValidation({
        valid: false,
        errors: valResult.errors,
        warnings: [],
        matchedCount: 0,
      });
    } else if (valResult.rankings) {
      const { warnings, matchedCount } = applyCustomRankingsToPool(POOL.players, valResult.rankings);
      setValidation({
        valid: true,
        errors: [],
        warnings,
        matchedCount,
        rankings: valResult.rankings,
      });
    }
  }, [pasteText, activeTab]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.replace(/\.[^/.]+$/, "");
    setPresetName(fileName);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const valResult = validateCustomRankings(text);
      if (!valResult.valid) {
        setValidation({
          valid: false,
          errors: valResult.errors,
          warnings: [],
          matchedCount: 0,
        });
      } else if (valResult.rankings) {
        const { warnings, matchedCount } = applyCustomRankingsToPool(POOL.players, valResult.rankings);
        setValidation({
          valid: true,
          errors: [],
          warnings,
          matchedCount,
          rankings: valResult.rankings,
        });
      }
    };
    reader.onerror = () => {
      setValidation({
        valid: false,
        errors: ['Failed to read file.'],
        warnings: [],
        matchedCount: 0,
      });
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const fileExt = file.name.split('.').pop()?.toLowerCase();
    const isValidCsv = fileExt === 'csv' || file.type === 'text/csv' || file.type === 'application/vnd.ms-excel';
    if (!isValidCsv) {
      setValidation({
        valid: false,
        errors: ['Invalid file type. Please upload a .csv file.'],
        warnings: [],
        matchedCount: 0,
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const valResult = validateCustomRankings(text);
      if (!valResult.valid) {
        setValidation({
          valid: false,
          errors: valResult.errors,
          warnings: [],
          matchedCount: 0,
        });
      } else if (valResult.rankings) {
        const { warnings, matchedCount } = applyCustomRankingsToPool(POOL.players, valResult.rankings);
        setValidation({
          valid: true,
          errors: [],
          warnings,
          matchedCount,
          rankings: valResult.rankings,
        });
      }
    };
    reader.readAsText(file);
  };

  const copyTemplate = () => {
    navigator.clipboard.writeText(TEMPLATE_RANKINGS_CSV).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_RANKINGS_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'custom_rankings_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSave = () => {
    if (validation && validation.valid && validation.rankings) {
      const name = presetName.trim() || 'Custom Rankings';
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const presets = getSavedPresets();
      
      const existingIdx = presets.findIndex(p => p.id === id || p.name.toLowerCase() === name.toLowerCase());
      const newPreset: CustomRankingPreset = {
        id: existingIdx >= 0 ? presets[existingIdx].id : id + '-' + Date.now(),
        name,
        rankings: validation.rankings,
        updatedAt: Date.now(),
      };

      if (existingIdx >= 0) {
        presets[existingIdx] = newPreset;
      } else {
        presets.push(newPreset);
      }

      savePresets(presets);
      setActivePresetId(newPreset.id);
      applyActivePreset(newPreset.id);
      onApply();
    }
  };

  // Close modal when pressing Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>CUSTOM PLAYER RANKINGS</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close modal">
            &times;
          </button>
        </div>

        <div className={styles.body}>
          <p className={styles.description}>
            Provide player rankings in CSV format to replace the site's default consensus rankings.
            Matches are resolved by player name, position, and optional ID.
          </p>

          <div className={styles.tabs} role="tablist">
            <button
              type="button"
              className={activeTab === 'upload' ? styles.tabActive : styles.tab}
              onClick={() => {
                setActiveTab('upload');
                setValidation(null);
              }}
              role="tab"
              aria-selected={activeTab === 'upload'}
            >
              UPLOAD FILE
            </button>
            <button
              type="button"
              className={activeTab === 'paste' ? styles.tabActive : styles.tab}
              onClick={() => {
                setActiveTab('paste');
                setValidation(null);
              }}
              role="tab"
              aria-selected={activeTab === 'paste'}
            >
              PASTE CSV
            </button>
            <button
              type="button"
              className={activeTab === 'template' ? styles.tabActive : styles.tab}
              onClick={() => {
                setActiveTab('template');
                setValidation(null);
              }}
              role="tab"
              aria-selected={activeTab === 'template'}
            >
              EXAMPLE TEMPLATE
            </button>
          </div>

          <div className={styles.tabContent}>
            {activeTab === 'upload' && (
              <div
                className={styles.fileDropzone}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <p>Drag and drop your rankings .csv file here, or click to browse</p>
                <button type="button" className={styles.fileBtn}>
                  CHOOSE FILE
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className={styles.fileDropzoneInput}
                  onChange={handleFileUpload}
                />
              </div>
            )}

            {activeTab === 'paste' && (
              <textarea
                className={styles.textarea}
                placeholder={`Paste your CSV rankings here. Example:\nOverall,Player,Position,Tier\n1,Ja'Marr Chase,WR,1\n2,Bijan Robinson,RB,1`}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
              />
            )}

            {activeTab === 'template' && (
              <div className={styles.templateContainer}>
                <pre className={styles.templatePre}>
                  <code>{TEMPLATE_RANKINGS_CSV}</code>
                </pre>
                <div className={styles.templateActions}>
                  <button type="button" className={styles.fileBtn} onClick={copyTemplate}>
                    {copied ? 'COPIED!' : 'COPY TEMPLATE'}
                  </button>
                  <button type="button" className={styles.fileBtn} onClick={downloadTemplate}>
                    DOWNLOAD TEMPLATE
                  </button>
                </div>
              </div>
            )}
          </div>

          {validation && validation.valid && (
            <div className={styles.nameField} style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', color: 'var(--bone-dim)', marginBottom: '0.5rem' }}>
                RANKINGS PRESET NAME
              </label>
              <input
                type="text"
                className={styles.nameInput}
                style={{ width: '100%', padding: '0.65rem 0.8rem', background: 'var(--ink)', border: '2px solid var(--bone-dim)', color: 'var(--bone)', fontFamily: 'inherit' }}
                placeholder="e.g. My PPR Rankings"
                value={presetName}
                onChange={e => setPresetName(e.target.value)}
              />
            </div>
          )}

          {validation && (
            <div className={validation.valid ? styles.statusSuccess : styles.statusError}>
              {validation.valid ? (
                <>
                  <h4 className={styles.statusTitleSuccess}>
                    ✔ RANKINGS VALID
                  </h4>
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem' }}>
                    Successfully parsed and matched <strong>{validation.matchedCount}</strong> player(s) in the draft pool.
                  </p>
                  {validation.warnings.length > 0 && (
                    <div className={styles.warningSection}>
                      <div className={styles.warningTitle}>Unmatched Players ({validation.warnings.length}):</div>
                      <ul className={styles.warningList}>
                        {validation.warnings.map((warn, i) => (
                          <li key={i}>{warn}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h4 className={styles.statusTitleError}>
                    ❌ PARSING/VALIDATION ERROR
                  </h4>
                  <ul className={styles.errorList}>
                    {validation.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.btnCancel} onClick={onClose}>
            CANCEL
          </button>
          <button
            type="button"
            className={styles.btnApply}
            disabled={!validation || !validation.valid}
            onClick={handleSave}
          >
            SAVE & APPLY
          </button>
        </div>
      </div>
    </div>
  );
}
