import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export interface PDFReportData {
  title: string
  generatedAt: string
  hostName?: string
  healthScore: number
  systemStatus: 'HEALTHY' | 'ELEVATED' | 'CRITICAL'
  metrics: {
    cpuPercent: number
    ramPercent: number
    diskPercent: number
    cpuFreqMhz?: number
    ramUsedMb?: number
    ramTotalMb?: number
    diskUsedGb?: number
    diskTotalGb?: number
  } | null
  policy: {
    simulationMode: boolean
    cpuWarning: number
    cpuCritical: number
    ramWarning: number
    ramCritical: number
    blacklist: string[]
    whitelist: string[]
  } | null
  incidents: Array<{
    id: string
    processName: string
    pid: number
    severity: string
    status: string
    description: string
    detectedAt?: string
    actions?: Array<{
      action_type: string
      executed_at: string
      simulated: boolean
      reason?: string
    }>
  }>
  sha256Digest?: string
}

/**
 * Renders an HTML element into a high-DPI PDF file download using html2canvas & jsPDF.
 */
export async function downloadElementAsPDF(
  element: HTMLElement,
  filename: string = `Nexus_OS_Guardian_Report_${new Date().toISOString().slice(0, 10)}.pdf`
): Promise<void> {
  // Capture canvas with 2x scale for crisp text rendering
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    windowWidth: 1000,
  })

  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pdfWidth = pdf.internal.pageSize.getWidth() // 210 mm
  const pdfHeight = pdf.internal.pageSize.getHeight() // 297 mm

  const imgWidth = pdfWidth
  const imgHeight = (canvas.height * pdfWidth) / canvas.width

  let heightLeft = imgHeight
  let position = 0

  // First page
  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST')
  heightLeft -= pdfHeight

  // Additional pages if report exceeds A4 height
  while (heightLeft > 0) {
    position = heightLeft - imgHeight
    pdf.addPage()
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST')
    heightLeft -= pdfHeight
  }

  pdf.save(filename)
}
