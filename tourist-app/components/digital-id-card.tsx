'use client'

import React, { useEffect, useState, useRef } from 'react'

// ─── Types ──────────────────────────────────────────────────────────────────

interface DigitalIdData {
    digitalId: {
        id: string
        issuedAt: string
        expiresAt: string
        qrPayload: any
        qrImageBase64: string
        payloadHash: string
        blockchainTxHash: string | null
        blockchainExplorerUrl: string | null
        blockchainSuccess: boolean
        status: 'active' | 'expired' | 'revoked'
    }
    identity: {
        name: string
        email: string
        phone: string
        nationality: string
        passportNumber: string
    }
    trip: {
        _id: string
        title: string
        destination: string
        startDate: string
        endDate: string
        status: 'active' | 'upcoming' | 'past'
    }
    emergency: {
        bloodType: string
        conditions: string
        medications: string
        allergies: string
        doctorName: string
        doctorContact: string
        insuranceProvider: string
        insuranceNumber: string
        emergencyContactName: string
        emergencyContactPhone: string
        emergencyContactRelation: string
    }
}

interface DigitalIdCardProps {
    tripId: string
    token: string
    onClose?: () => void
}

// ─── Helper Functions ───────────────────────────────────────────────────────

function maskPassport(passport: string): string {
    if (!passport || passport.length < 4) return passport || 'Not provided'
    return passport.slice(0, 4) + '****' + passport.slice(-2)
}

function formatDate(dateStr: string): string {
    if (!dateStr) return 'N/A'
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function getNationalityFlag(nationality: string): string {
    const flagMap: Record<string, string> = {
        'Indian': '🇮🇳', 'American': '🇺🇸', 'British': '🇬🇧', 'Canadian': '🇨🇦',
        'Australian': '🇦🇺', 'German': '🇩🇪', 'French': '🇫🇷', 'Japanese': '🇯🇵',
        'Chinese': '🇨🇳', 'Korean': '🇰🇷', 'Brazilian': '🇧🇷', 'Italian': '🇮🇹',
        'Spanish': '🇪🇸', 'Russian': '🇷🇺', 'Mexican': '🇲🇽', 'Thai': '🇹🇭',
    }
    return flagMap[nationality] || '🌍'
}

function getStatusConfig(status: string) {
    switch (status) {
        case 'active':
            return { color: '#22c55e', bg: '#22c55e20', label: 'ACTIVE', pulse: true }
        case 'upcoming':
            return { color: '#3b82f6', bg: '#3b82f620', label: 'UPCOMING', pulse: false }
        case 'past':
        case 'expired':
            return { color: '#6b7280', bg: '#6b728020', label: 'EXPIRED', pulse: false }
        case 'revoked':
            return { color: '#ef4444', bg: '#ef444420', label: 'REVOKED', pulse: false }
        default:
            return { color: '#6b7280', bg: '#6b728020', label: status.toUpperCase(), pulse: false }
    }
}

function truncateHash(hash: string | null): string {
    if (!hash) return 'N/A'
    return hash.slice(0, 10) + '...' + hash.slice(-8)
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function DigitalIdCard({ tripId, token, onClose }: DigitalIdCardProps) {
    const [data, setData] = useState<DigitalIdData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const cardRef = useRef<HTMLDivElement>(null)
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        fetchDigitalId()
    }, [tripId])

    useEffect(() => {
        if (data) {
            // Trigger fade-in animation
            requestAnimationFrame(() => setVisible(true))
        }
    }, [data])

    async function fetchDigitalId() {
        try {
            setLoading(true)
            const res = await fetch(`/api/trips/${tripId}/digital-id`, {
                headers: { Authorization: `Bearer ${token}` },
            })
            if (!res.ok) {
                const errData = await res.json()
                throw new Error(errData.error || 'Failed to fetch Digital ID')
            }
            const json = await res.json()
            setData(json)
        } catch (e: any) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    async function handleDownload() {
        if (!data) return
        try {
            const html2canvas = (await import('html2canvas')).default
            const cardEl = cardRef.current
            if (!cardEl) return

            const canvas = await html2canvas(cardEl, {
                scale: 2,
                backgroundColor: '#ffffff',
                useCORS: true,
            })

            const link = document.createElement('a')
            link.download = `Setuka-${data.digitalId.id}.png`
            link.href = canvas.toDataURL('image/png')
            link.click()
        } catch (e) {
            console.error('Download failed:', e)
        }
    }

    async function handleShare() {
        if (!data) return
        try {
            if (navigator.share) {
                await navigator.share({
                    title: `Setuka Digital Tourist ID — ${data.identity.name}`,
                    text: `Tourist ID: ${data.digitalId.id}\nDestination: ${data.trip.destination}\nVerify: ${data.digitalId.qrPayload.verifyUrl}`,
                    url: data.digitalId.qrPayload.verifyUrl,
                })
            } else {
                await navigator.clipboard.writeText(data.digitalId.qrPayload.verifyUrl)
                alert('Verification link copied to clipboard!')
            }
        } catch (e) {
            console.error('Share failed:', e)
        }
    }

    // ─── Loading Skeleton ──────────────────────────────────────────────────

    if (loading) {
        return (
            <div style={styles.card}>
                <div style={styles.skeletonHeader}>
                    <div style={{ ...styles.skeleton, width: '60%', height: 24 }} />
                    <div style={{ ...styles.skeleton, width: 80, height: 28, borderRadius: 14 }} />
                </div>
                <div style={styles.skeletonSection}>
                    <div style={{ ...styles.skeleton, width: 48, height: 48, borderRadius: 24 }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                        <div style={{ ...styles.skeleton, width: '70%', height: 18 }} />
                        <div style={{ ...styles.skeleton, width: '50%', height: 14 }} />
                        <div style={{ ...styles.skeleton, width: '40%', height: 14 }} />
                    </div>
                </div>
                <div style={{ ...styles.skeleton, height: 60, borderRadius: 12 }} />
                <div style={{ ...styles.skeleton, height: 100, borderRadius: 12 }} />
                <div style={styles.skeletonQR}>
                    <div style={{ ...styles.skeleton, width: 180, height: 180, borderRadius: 12 }} />
                    <div style={{ ...styles.skeleton, width: '60%', height: 16 }} />
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div style={{ ...styles.card, textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
                <h3 style={{ color: '#ef4444', margin: '0 0 8px' }}>Could not load Digital ID</h3>
                <p style={{ color: '#666', fontSize: 14 }}>{error}</p>
            </div>
        )
    }

    if (!data) return null

    const { digitalId, identity, trip, emergency } = data
    const statusConfig = getStatusConfig(digitalId.status)
    const tripStatusConfig = getStatusConfig(trip.status)

    return (
        <div
            ref={cardRef}
            style={{
                ...styles.card,
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(12px)',
                transition: 'opacity 0.5s ease, transform 0.5s ease',
            }}
        >
            {/* ─── HEADER ─────────────────────────────────────────────────── */}
            <div style={styles.header}>
                <div style={styles.headerLeft}>
                    <div style={styles.logo}>🛡️</div>
                    <div>
                        <div style={styles.brandName}>SETUKA</div>
                        <div style={styles.cardLabel}>Digital Tourist ID</div>
                    </div>
                </div>
                <div style={{ ...styles.statusBadge, backgroundColor: statusConfig.bg, color: statusConfig.color }}>
                    {statusConfig.pulse && <span style={styles.pulsingDot(statusConfig.color)} />}
                    {statusConfig.label}
                </div>
            </div>

            <div style={styles.divider} />

            {/* ─── IDENTITY ───────────────────────────────────────────────── */}
            <div style={styles.identitySection}>
                <div style={styles.avatar}>
                    {identity.name ? identity.name.charAt(0).toUpperCase() : '?'}
                </div>
                <div style={styles.identityInfo}>
                    <div style={styles.touristName}>{identity.name || 'Unknown'}</div>
                    <div style={styles.nationality}>
                        {getNationalityFlag(identity.nationality)} {identity.nationality || 'Not specified'}
                    </div>
                    <div style={styles.passportLabel}>
                        Passport: <span style={styles.passportNumber}>{maskPassport(identity.passportNumber)}</span>
                    </div>
                </div>
            </div>

            {/* ─── TRIP ───────────────────────────────────────────────────── */}
            <div style={styles.tripSection}>
                <div style={styles.tripTitle}>{trip.title}</div>
                <div style={styles.tripDestination}>📍 {trip.destination}</div>
                <div style={styles.tripDates}>
                    📅 {formatDate(trip.startDate)} → {formatDate(trip.endDate)}
                </div>
                <div style={{
                    ...styles.tripStatusBadge,
                    backgroundColor: tripStatusConfig.bg,
                    color: tripStatusConfig.color,
                }}>
                    {tripStatusConfig.label}
                </div>
            </div>

            {/* ─── EMERGENCY ──────────────────────────────────────────────── */}
            <div style={styles.emergencySection}>
                <div style={styles.emergencyHeader}>🚨 Emergency Information</div>
                <div style={styles.emergencyGrid}>
                    <div style={styles.bloodTypeBox}>
                        <div style={styles.bloodTypeLabel}>Blood Type</div>
                        <div style={styles.bloodTypeValue}>{emergency.bloodType || '—'}</div>
                    </div>
                    <div style={styles.emergencyDetails}>
                        <div style={styles.emergencyRow}>
                            <span style={styles.emergencyLabel}>⚠️ Allergies:</span>
                            <span>{emergency.allergies || 'None reported'}</span>
                        </div>
                        <div style={styles.emergencyRow}>
                            <span style={styles.emergencyLabel}>💊 Medications:</span>
                            <span>{emergency.medications || 'None'}</span>
                        </div>
                    </div>
                </div>

                <div style={styles.emergencyContactBox}>
                    <div style={styles.emergencyRow}>
                        <span style={styles.emergencyLabel}>📞 Emergency Contact:</span>
                        <span>
                            {emergency.emergencyContactName || 'Not provided'}
                            {emergency.emergencyContactRelation && ` (${emergency.emergencyContactRelation})`}
                        </span>
                    </div>
                    {emergency.emergencyContactPhone && (
                        <a href={`tel:${emergency.emergencyContactPhone}`} style={styles.phoneLink}>
                            📱 {emergency.emergencyContactPhone}
                        </a>
                    )}
                </div>

                {(emergency.insuranceProvider || emergency.insuranceNumber) && (
                    <div style={styles.insuranceRow}>
                        <span style={styles.emergencyLabel}>🏥 Insurance:</span>
                        <span>{emergency.insuranceProvider || ''} {emergency.insuranceNumber ? `· ${emergency.insuranceNumber}` : ''}</span>
                    </div>
                )}
            </div>

            {/* ─── QR CODE ────────────────────────────────────────────────── */}
            <div style={styles.qrSection}>
                {digitalId.qrImageBase64 && (
                    <img
                        src={digitalId.qrImageBase64}
                        alt="Digital ID QR Code"
                        style={styles.qrImage}
                    />
                )}

                <div style={styles.tidDisplay}>{digitalId.id}</div>

                {digitalId.blockchainSuccess && (
                    <div style={styles.blockchainBadge}>
                        <span style={styles.pulsingDot('#22c55e')} />
                        Blockchain Verified
                    </div>
                )}

                {digitalId.blockchainTxHash && (
                    <div style={styles.txHashRow}>
                        <span style={styles.txHashLabel}>Tx:</span>
                        <span style={styles.txHash}>{truncateHash(digitalId.blockchainTxHash)}</span>
                    </div>
                )}

                {digitalId.blockchainExplorerUrl && (
                    <a
                        href={digitalId.blockchainExplorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={styles.explorerLink}
                    >
                        View on PolygonScan ↗
                    </a>
                )}

                <div style={styles.actionButtons}>
                    <button onClick={handleDownload} style={styles.downloadBtn}>
                        ⬇ Download
                    </button>
                    <button onClick={handleShare} style={styles.shareBtn}>
                        📤 Share
                    </button>
                </div>
            </div>

            {/* ─── FOOTER ───────────────────────────────────────────────── */}
            <div style={styles.footer}>
                <div>Issued: {formatDate(digitalId.issuedAt)}</div>
                <div>Valid until: {formatDate(digitalId.expiresAt)}</div>
            </div>

            {/* ─── CLOSE BUTTON ────────────────────────────────────────── */}
            {onClose && (
                <button onClick={onClose} style={styles.closeBtn} aria-label="Close">
                    ✕
                </button>
            )}
        </div>
    )
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles: Record<string, any> = {
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        overflow: 'hidden',
        maxWidth: 420,
        margin: '0 auto',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
        fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
        position: 'relative' as const,
        border: '1px solid #e5e7eb',
    },

    // ─── Header
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 20px',
        background: 'linear-gradient(135deg, #1a3a2a 0%, #2d5a3f 100%)',
        color: '#ffffff',
    },
    headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
    logo: { fontSize: 28 },
    brandName: { fontSize: 18, fontWeight: 800, letterSpacing: 2 },
    cardLabel: { fontSize: 11, opacity: 0.85, letterSpacing: 1 },
    statusBadge: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 12px',
        borderRadius: 14,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.5,
    },
    pulsingDot: (color: string) => ({
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: color,
        animation: 'pulse-dot 2s ease-in-out infinite',
    }),

    divider: { height: 1, background: '#e5e7eb' },

    // ─── Identity
    identitySection: {
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '16px 20px',
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #1a3a2a, #2d5a3f)',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 22,
        fontWeight: 700,
        flexShrink: 0,
    },
    identityInfo: { flex: 1 },
    touristName: { fontSize: 18, fontWeight: 700, color: '#111827', lineHeight: 1.3 },
    nationality: { fontSize: 14, color: '#4b5563', marginTop: 2 },
    passportLabel: { fontSize: 13, color: '#6b7280', marginTop: 4 },
    passportNumber: { fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: '#374151' },

    // ─── Trip
    tripSection: {
        padding: '12px 20px',
        backgroundColor: '#f9fafb',
        borderTop: '1px solid #e5e7eb',
        borderBottom: '1px solid #e5e7eb',
    },
    tripTitle: { fontSize: 15, fontWeight: 600, color: '#111827' },
    tripDestination: { fontSize: 14, color: '#4b5563', marginTop: 4 },
    tripDates: { fontSize: 13, color: '#6b7280', marginTop: 4 },
    tripStatusBadge: {
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 10,
        fontSize: 11,
        fontWeight: 700,
        marginTop: 6,
    },

    // ─── Emergency
    emergencySection: {
        padding: '14px 20px',
        backgroundColor: '#fef2f2',
        borderBottom: '1px solid #fecaca',
    },
    emergencyHeader: {
        fontSize: 14,
        fontWeight: 700,
        color: '#991b1b',
        marginBottom: 10,
    },
    emergencyGrid: {
        display: 'flex',
        gap: 14,
        marginBottom: 10,
    },
    bloodTypeBox: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: '10px 16px',
        textAlign: 'center' as const,
        border: '2px solid #fca5a5',
        minWidth: 72,
    },
    bloodTypeLabel: { fontSize: 10, color: '#991b1b', fontWeight: 600, textTransform: 'uppercase' as const },
    bloodTypeValue: { fontSize: 28, fontWeight: 800, color: '#dc2626', lineHeight: 1.2 },
    emergencyDetails: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column' as const,
        justifyContent: 'center',
        gap: 4,
    },
    emergencyRow: { fontSize: 13, color: '#374151' },
    emergencyLabel: { fontWeight: 600, marginRight: 4 },
    emergencyContactBox: {
        backgroundColor: '#ffffff',
        borderRadius: 8,
        padding: '8px 12px',
        marginBottom: 6,
    },
    phoneLink: {
        display: 'inline-block',
        color: '#1d4ed8',
        fontSize: 14,
        fontWeight: 600,
        marginTop: 4,
        textDecoration: 'none',
    },
    insuranceRow: { fontSize: 13, color: '#374151' },

    // ─── QR
    qrSection: {
        padding: '16px 20px',
        textAlign: 'center' as const,
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        gap: 8,
    },
    qrImage: {
        width: 180,
        height: 180,
        borderRadius: 8,
        border: '2px solid #e5e7eb',
    },
    tidDisplay: {
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 15,
        fontWeight: 700,
        color: '#1a3a2a',
        letterSpacing: 1,
    },
    blockchainBadge: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 14px',
        borderRadius: 14,
        backgroundColor: '#dcfce7',
        color: '#166534',
        fontSize: 12,
        fontWeight: 700,
    },
    txHashRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11,
        color: '#9ca3af',
    },
    txHashLabel: { fontWeight: 600 },
    txHash: { fontFamily: "'JetBrains Mono', monospace" },
    explorerLink: {
        color: '#2563eb',
        fontSize: 13,
        fontWeight: 600,
        textDecoration: 'none',
    },
    actionButtons: {
        display: 'flex',
        gap: 10,
        marginTop: 8,
        width: '100%',
    },
    downloadBtn: {
        flex: 1,
        padding: '10px 0',
        borderRadius: 10,
        border: '1.5px solid #1a3a2a',
        backgroundColor: '#1a3a2a',
        color: '#ffffff',
        fontWeight: 700,
        fontSize: 14,
        cursor: 'pointer',
    },
    shareBtn: {
        flex: 1,
        padding: '10px 0',
        borderRadius: 10,
        border: '1.5px solid #1a3a2a',
        backgroundColor: '#ffffff',
        color: '#1a3a2a',
        fontWeight: 700,
        fontSize: 14,
        cursor: 'pointer',
    },

    // ─── Footer
    footer: {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '10px 20px',
        fontSize: 11,
        color: '#9ca3af',
        borderTop: '1px solid #e5e7eb',
    },

    // ─── Close button
    closeBtn: {
        position: 'absolute' as const,
        top: 12,
        right: 12,
        width: 28,
        height: 28,
        borderRadius: '50%',
        border: 'none',
        backgroundColor: 'rgba(255,255,255,0.2)',
        color: '#ffffff',
        fontSize: 14,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // ─── Skeleton loading
    skeleton: {
        backgroundColor: '#e5e7eb',
        borderRadius: 6,
        animation: 'skeleton-shimmer 1.5s ease-in-out infinite',
    },
    skeletonHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px',
        backgroundColor: '#f3f4f6',
    },
    skeletonSection: {
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '16px 20px',
    },
    skeletonQR: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        gap: 12,
        padding: '20px',
    },
}
