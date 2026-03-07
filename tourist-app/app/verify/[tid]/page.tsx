'use client'

import React, { useEffect, useState } from 'react'

interface VerifyData {
    verified: boolean
    tampered: boolean
    signatureValid: boolean
    status: 'active' | 'expired' | 'revoked' | 'upcoming'
    name: string
    nationality: string
    destination: string
    validPeriod: string  // "YYYY-MM-DD/YYYY-MM-DD"
    emergency: {
        bloodType: string
        allergies: string
        medications: string
        emergencyContactName: string
        emergencyContactPhone: string
        emergencyContactRelation: string
        insuranceProvider: string
        insuranceNumber: string
    }
    blockchain: {
        anchored: boolean
        network: string
        chainId: number
        contractAddress: string
        txHash: string | null
        explorerUrl: string | null
        onChainVerified?: boolean
        hashMatches?: boolean
        isActiveOnChain?: boolean
    }
    tid: string
    issuedAt: string
}

function parseValidPeriod(vp: string): { from: string; to: string } {
    if (!vp || !vp.includes('/')) return { from: '', to: '' }
    const [from, to] = vp.split('/')
    return { from, to }
}

function formatDate(dateStr: string): string {
    if (!dateStr) return 'N/A'
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function truncateHash(hash: string | null): string {
    if (!hash) return 'N/A'
    if (hash.length <= 20) return hash
    return hash.slice(0, 10) + '...' + hash.slice(-8)
}

export default function VerifyPage({ params }: { params: Promise<{ tid: string }> }) {
    const [tid, setTid] = useState<string>('')
    const [data, setData] = useState<VerifyData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        params.then(p => {
            setTid(p.tid)
            fetchVerification(p.tid)
        })
    }, [])

    async function fetchVerification(tidVal: string) {
        try {
            setLoading(true)
            const res = await fetch(`/api/verify/${tidVal}`)
            if (!res.ok) {
                const errData = await res.json()
                throw new Error(errData.error || 'Verification failed')
            }
            const json = await res.json()
            setData(json)
        } catch (e: any) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    // ── Loading ──────────────────────────────────────────────────────
    if (loading) {
        return (
            <div style={pageStyle}>
                <div style={loadingContainer}>
                    <div style={spinnerStyle} />
                    <p style={{ color: '#6b7280', fontSize: 16, marginTop: 16 }}>
                        Verifying tourist identity...
                    </p>
                    <p style={{ color: '#9ca3af', fontSize: 13 }}>
                        Checking Polygon Amoy Testnet
                    </p>
                </div>
            </div>
        )
    }

    // ── Error ────────────────────────────────────────────────────────
    if (error) {
        return (
            <div style={pageStyle}>
                <div style={{ ...bannerStyle, backgroundColor: '#ef4444' }}>
                    <div style={{ fontSize: 64 }}>❌</div>
                    <h1 style={bannerTitle}>Verification Failed</h1>
                    <p style={bannerSubtitle}>{error}</p>
                </div>
                <div style={cardContainer}>
                    <div style={tidFooter}>
                        <span style={tidLabel}>TID: </span>
                        <span style={tidValue}>{tid}</span>
                    </div>
                </div>
            </div>
        )
    }

    if (!data) return null

    const isVerified = data.verified && !data.tampered
    const isDangerous = data.tampered || data.status === 'revoked'

    return (
        <div style={pageStyle}>
            {/* ─── CSS Animations ──────────────────────────────────────── */}
            <style>{`
        @keyframes pulse-verify {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spinner {
          to { transform: rotate(360deg); }
        }
      `}</style>

            {/* ─── BANNER ──────────────────────────────────────────────── */}
            <div style={{
                ...bannerStyle,
                backgroundColor: isDangerous ? '#ef4444' : isVerified ? '#166534' : '#f59e0b',
            }}>
                <div style={{ fontSize: 64, animation: 'pulse-verify 2s ease-in-out infinite' }}>
                    {isDangerous ? '❌' : isVerified ? '✅' : '⚠️'}
                </div>
                <h1 style={bannerTitle}>
                    {isDangerous
                        ? (data.tampered ? 'WARNING: Data Tampered' : 'ID Revoked')
                        : isVerified
                            ? 'Identity Verified'
                            : (data.status === 'expired' ? 'ID Expired' : 'Pending Verification')}
                </h1>
                <p style={bannerSubtitle}>
                    Polygon Amoy Testnet · {isDangerous ? 'Integrity Compromised' : 'Blockchain Confirmed'}
                </p>
            </div>

            {/* ─── CONTENT ─────────────────────────────────────────────── */}
            <div style={cardContainer}>

                {/* ─── Tourist Info ───────────────────────────── */}
                <div style={sectionCard}>
                    <h2 style={sectionTitle}>👤 Tourist Information</h2>
                    <div style={infoRow}>
                        <span style={infoLabel}>Name</span>
                        <span style={infoValue}>{data.name || 'Not available'}</span>
                    </div>
                    <div style={infoRow}>
                        <span style={infoLabel}>Nationality</span>
                        <span style={infoValue}>{data.nationality || 'Not specified'}</span>
                    </div>
                    <div style={infoRow}>
                        <span style={infoLabel}>Destination</span>
                        <span style={infoValue}>{data.destination || 'Not specified'}</span>
                    </div>
                    <div style={infoRow}>
                        <span style={infoLabel}>Valid Period</span>
                        <span style={infoValue}>{formatDate(parseValidPeriod(data.validPeriod).from)} → {formatDate(parseValidPeriod(data.validPeriod).to)}</span>
                    </div>
                </div>

                {/* ─── Emergency (red-tinted) ───────────────── */}
                <div style={emergencyCard}>
                    <h2 style={{ ...sectionTitle, color: '#991b1b' }}>🚨 Emergency Information</h2>

                    <div style={bloodTypeContainer}>
                        <div style={bloodTypeLabel}>BLOOD TYPE</div>
                        <div style={bloodTypeValue}>{data.emergency.bloodType || '—'}</div>
                    </div>

                    <div style={infoRow}>
                        <span style={{ ...infoLabel, color: '#991b1b' }}>⚠️ Allergies</span>
                        <span style={infoValue}>{data.emergency.allergies || 'None reported'}</span>
                    </div>
                    <div style={infoRow}>
                        <span style={{ ...infoLabel, color: '#991b1b' }}>💊 Medications</span>
                        <span style={infoValue}>{data.emergency.medications || 'None'}</span>
                    </div>

                    <div style={emergencyContactCard}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#991b1b', marginBottom: 4 }}>
                            📞 Emergency Contact
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>
                            {data.emergency.emergencyContactName || 'Not provided'}
                            {data.emergency.emergencyContactRelation && ` (${data.emergency.emergencyContactRelation})`}
                        </div>
                        {data.emergency.emergencyContactPhone && (
                            <a
                                href={`tel:${data.emergency.emergencyContactPhone}`}
                                style={phoneLinkStyle}
                            >
                                📱 {data.emergency.emergencyContactPhone}
                            </a>
                        )}
                    </div>

                    {(data.emergency.insuranceProvider || data.emergency.insuranceNumber) && (
                        <div style={infoRow}>
                            <span style={{ ...infoLabel, color: '#991b1b' }}>🏥 Insurance</span>
                            <span style={infoValue}>
                                {data.emergency.insuranceProvider}
                                {data.emergency.insuranceNumber && ` · ${data.emergency.insuranceNumber}`}
                            </span>
                        </div>
                    )}
                </div>

                {/* ─── Blockchain Proof ────────────────────── */}
                <div style={sectionCard}>
                    <h2 style={sectionTitle}>🔗 Blockchain Proof</h2>
                    <div style={infoRow}>
                        <span style={infoLabel}>Network</span>
                        <span style={infoValue}>{data.blockchain.network}</span>
                    </div>
                    <div style={infoRow}>
                        <span style={infoLabel}>Chain ID</span>
                        <span style={infoValue}>{data.blockchain.chainId}</span>
                    </div>
                    {data.blockchain.txHash && (
                        <div style={infoRow}>
                            <span style={infoLabel}>Transaction</span>
                            <span style={{ ...infoValue, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                                {truncateHash(data.blockchain.txHash)}
                            </span>
                        </div>
                    )}
                    {data.blockchain.explorerUrl && (
                        <a
                            href={data.blockchain.explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={explorerLinkStyle}
                        >
                            View on PolygonScan ↗
                        </a>
                    )}
                    <div style={infoRow}>
                        <span style={infoLabel}>Registered</span>
                        <span style={infoValue}>{formatDate(data.issuedAt)}</span>
                    </div>
                    <div style={infoRow}>
                        <span style={infoLabel}>On-Chain Status</span>
                        <span style={{
                            ...infoValue,
                            color: data.blockchain.onChainVerified ? '#166534' : data.blockchain.anchored ? '#b45309' : '#6b7280'
                        }}>
                            {data.blockchain.onChainVerified
                                ? '✅ Verified'
                                : data.blockchain.anchored
                                    ? '⏳ Anchored (verification pending)'
                                    : '○ Not anchored on-chain'}
                        </span>
                    </div>
                </div>

                {/* ─── Footer ─────────────────────────────── */}
                <div style={footerSection}>
                    <div style={tidFooter}>
                        <span style={tidLabel}>Tourist ID: </span>
                        <span style={tidValue}>{data.tid}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>
                        {data.destination} · {formatDate(parseValidPeriod(data.validPeriod).from)} → {formatDate(parseValidPeriod(data.validPeriod).to)}
                    </div>
                    <div style={auditLine}>
                        🔒 Scan logged — access audited
                    </div>
                </div>

                {/* ─── Setuka Branding ────────────────────── */}
                <div style={brandFooter}>
                    🛡️ Setuka Tourist Safety System
                </div>
            </div>
        </div>
    )
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    backgroundColor: '#f3f4f6',
    fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
}

const loadingContainer: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
}

const spinnerStyle: React.CSSProperties = {
    width: 40,
    height: 40,
    border: '4px solid #e5e7eb',
    borderTopColor: '#1a3a2a',
    borderRadius: '50%',
    animation: 'spinner 0.8s linear infinite',
}

const bannerStyle: React.CSSProperties = {
    padding: '40px 20px',
    textAlign: 'center',
    color: '#ffffff',
}

const bannerTitle: React.CSSProperties = {
    fontSize: 26,
    fontWeight: 800,
    margin: '12px 0 4px',
}

const bannerSubtitle: React.CSSProperties = {
    fontSize: 14,
    opacity: 0.9,
    fontWeight: 500,
}

const cardContainer: React.CSSProperties = {
    maxWidth: 480,
    margin: '-20px auto 0',
    padding: '0 16px 32px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
}

const sectionCard: React.CSSProperties = {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: '16px 20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    animation: 'fadeInUp 0.5s ease forwards',
}

const emergencyCard: React.CSSProperties = {
    ...sectionCard,
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
}

const sectionTitle: React.CSSProperties = {
    fontSize: 16,
    fontWeight: 700,
    color: '#111827',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: '1px solid #e5e7eb',
}

const infoRow: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 0',
}

const infoLabel: React.CSSProperties = {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: 600,
}

const infoValue: React.CSSProperties = {
    fontSize: 14,
    color: '#111827',
    fontWeight: 500,
    textAlign: 'right',
}

const bloodTypeContainer: React.CSSProperties = {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: '12px',
    textAlign: 'center',
    border: '2px solid #fca5a5',
    marginBottom: 12,
    width: 100,
}

const bloodTypeLabel: React.CSSProperties = {
    fontSize: 10,
    color: '#991b1b',
    fontWeight: 700,
    letterSpacing: 1,
}

const bloodTypeValue: React.CSSProperties = {
    fontSize: 36,
    fontWeight: 800,
    color: '#dc2626',
    lineHeight: 1.2,
}

const emergencyContactCard: React.CSSProperties = {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: '10px 14px',
    margin: '8px 0',
}

const phoneLinkStyle: React.CSSProperties = {
    display: 'inline-block',
    color: '#1d4ed8',
    fontSize: 16,
    fontWeight: 700,
    marginTop: 4,
    textDecoration: 'none',
}

const explorerLinkStyle: React.CSSProperties = {
    display: 'block',
    color: '#2563eb',
    fontSize: 14,
    fontWeight: 700,
    textDecoration: 'none',
    padding: '8px 0',
    textAlign: 'center',
}

const footerSection: React.CSSProperties = {
    textAlign: 'center',
    padding: '12px 0',
}

const tidFooter: React.CSSProperties = {
    fontSize: 14,
}

const tidLabel: React.CSSProperties = {
    color: '#6b7280',
    fontWeight: 600,
}

const tidValue: React.CSSProperties = {
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: 700,
    color: '#1a3a2a',
    letterSpacing: 1,
}

const auditLine: React.CSSProperties = {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 8,
    fontStyle: 'italic',
}

const brandFooter: React.CSSProperties = {
    textAlign: 'center',
    fontSize: 13,
    color: '#6b7280',
    fontWeight: 600,
    padding: '12px 0',
}
