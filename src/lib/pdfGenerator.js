// Helper to format currency
const formatCurrency = (val) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(val) + " NETT";
};

// Format Date in Indonesian format
const formatIndoDate = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  
  const dayName = days[d.getDay()];
  const dateNum = d.getDate();
  const monthName = months[d.getMonth()];
  const year = d.getFullYear();
  
  return {
    full: `${dateNum} ${monthName} ${year}`,
    dayWithDate: `${dayName}, ${dateNum} ${monthName} ${year}`
  };
};

export async function generateInvoicePDF(project, userDetails) {
  // Dynamically import jsPDF to prevent Next.js SSR build/rendering errors
  const { jsPDF } = await import("jspdf");
  
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const user = {
    name: userDetails?.name || "Anthonius Ari Toelle",
    bank: userDetails?.bank || "CIMB Niaga",
    accountNo: userDetails?.accountNo || "703413786800",
    address: userDetails?.address || "Apt Pakubuwono Terrace S/23/B7, Cipulir, Kebayoran Lama, Jakarta",
    phone: userDetails?.phone || "087842252505"
  };

  const dateInfo = formatIndoDate(project.date);
  const formattedDate = dateInfo.full || "22 April 2026";

  // Setup styling - Clean Minimalist (Helvetica)
  doc.setFont("helvetica", "normal");
  
  // Title "invoice" - Extra Large, lowercase
  doc.setFontSize(44);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("invoice", 20, 35);

  // Date top right
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  doc.text(formattedDate, 190, 32, { align: "right" });

  // Top divider line
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.6);
  doc.line(20, 42, 190, 42);

  // Prepared By Section
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("Prepared By", 20, 52);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  doc.text(user.name, 20, 58);

  // Prepared For Section
  if (project.clientCompany && project.clientCompany.trim().length > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Prepared For", 20, 72);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    doc.text(project.clientCompany, 20, 78);
  }

  // Table Divider Line (Above table headings)
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.6);
  doc.line(20, 102, 190, 102);

  // Table Headers
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("Description", 20, 108);
  doc.text("Quantity", 125, 108, { align: "center" });
  doc.text("Amount", 190, 108, { align: "right" });

  // Table Divider Line (Below table headings)
  doc.setLineWidth(0.3);
  doc.line(20, 112, 190, 112);

  // Table Rows (Description, Qty, Amount)
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  
  // Wrap description text
  const cleanType = (project.projectType || "Package Color Grading Session").replace(/\s*\bTVC\b\s*/gi, "").trim();
  const descLines = doc.splitTextToSize(
    `${cleanType}\n${project.title}`,
    90
  );
  doc.text(descLines, 20, 120);
  doc.text("1", 125, 120, { align: "center" });
  
  const valText = formatCurrency(project.value);
  doc.text(valText, 190, 120, { align: "right" });

  const textHeight = descLines.length * 5;
  const tableBottom = 120 + textHeight + 5;

  // Table Bottom Divider Line
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.6);
  doc.line(20, tableBottom, 190, tableBottom);

  // Total Section
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("Total", 20, tableBottom + 8);
  doc.text(valText, 190, tableBottom + 8, { align: "right" });

  // Total Bottom Line
  doc.setLineWidth(0.6);
  doc.line(20, tableBottom + 13, 190, tableBottom + 13);

  // Payment Information Section
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Payment Information", 20, tableBottom + 25);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  doc.text(user.name, 20, tableBottom + 32);
  doc.text(`Bank : ${user.bank}`, 20, tableBottom + 39);
  doc.text(`Account No : ${user.accountNo}`, 20, tableBottom + 45);

  // Signature Block (on the right)
  const signatureY = tableBottom + 32;
  doc.text(`Jakarta, ${formattedDate}`, 190, signatureY, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(user.name, 190, signatureY + 20, { align: "right" });

  // Save PDF
  doc.save(`Invoice_${project.title.replace(/\s+/g, "_")}.pdf`);
}

export async function generateBASTPDF(project, userDetails) {
  // Dynamically import jsPDF to prevent Next.js SSR build/rendering errors
  const { jsPDF } = await import("jspdf");
  
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const user = {
    name: userDetails?.name || "Anthonius Ari Toelle",
    company: userDetails?.company || "Freelancer",
    address: userDetails?.address || "Apt Pakubuwono Terrace S/23/B7, Cipulir, Kebayoran Lama, Jakarta",
    phone: userDetails?.phone || "087842252505"
  };

  const dateInfo = formatIndoDate(project.date);
  const formattedDayAndDate = dateInfo.dayWithDate || "Rabu, 22 April 2026";
  const formattedDate = dateInfo.full || "22 April 2026";
  const formattedValue = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(project.value);

  // Styling - Formal Indonesian Document Style
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text("BERITA ACARA SERAH TERIMA PEKERJAAN", 105, 25, { align: "center" });

  // Body Text Settings
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);

  let y = 40;
  
  // Introductory sentence
  doc.text(`Pada hari ini ${formattedDayAndDate}, saya yang bertanda tangan dibawah ini :`, 20, y);
  
  // Pihak Pertama (User)
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.text("Nama", 20, y);
  doc.text("Perusahaan", 20, y + 6);
  doc.text("Alamat", 20, y + 12);
  doc.text("Nomor Telepon", 20, y + 24); // Leave more space for address

  doc.setFont("helvetica", "normal");
  doc.text(`: ${user.name}`, 55, y);
  doc.text(`: ${user.company}`, 55, y + 6);
  
  const userAddrLines = doc.splitTextToSize(`: ${user.address}`, 130);
  doc.text(userAddrLines, 55, y + 12);
  doc.text(`: ${user.phone}`, 55, y + 24);

  y += 32;
  doc.setFont("helvetica", "normal");
  doc.text("Selanjutnya disebut sebagai Pihak Pertama", 20, y);

  // Pihak Kedua (Client)
  y += 12;
  doc.setFont("helvetica", "bold");
  doc.text("Nama", 20, y);
  doc.text("Perusahaan", 20, y + 6);
  doc.text("Alamat", 20, y + 12);
  doc.text("Nomor Telepon", 20, y + 24);

  doc.setFont("helvetica", "normal");
  doc.text(`: ${project.contactName || "-"}`, 55, y);
  doc.text(`: ${project.clientCompany || "-"}`, 55, y + 6);
  
  const clientAddrLines = doc.splitTextToSize(`: ${project.clientAddress || "-"}`, 130);
  doc.text(clientAddrLines, 55, y + 12);
  doc.text(`: ${project.contactPhone || "-"}`, 55, y + 24);

  y += 32;
  doc.setFont("helvetica", "normal");
  doc.text("Selanjutnya disebut sebagai Pihak Kedua", 20, y);

  // Agreement and job details
  y += 15;
  const bastType = (project.projectType || "Color Grading Session").replace(/\s*\bTVC\b\s*/gi, "").trim();
  const agreementText = `Kedua belah pihak Sepakat untuk melakukan serah terima pekerjaan ${bastType} yang sudah selesai dilakukan oleh Pihak Pertama kepada Pihak Kedua untuk :`;
  const agreementLines = doc.splitTextToSize(agreementText, 170);
  doc.text(agreementLines, 20, y);

  y += agreementLines.length * 6 + 2;
  doc.setFont("helvetica", "bold");
  doc.text("Nama Pekerjaan", 20, y);
  doc.text("Jenis Pekerjaan", 20, y + 6);
  doc.text("Nominal", 20, y + 12);

  doc.setFont("helvetica", "normal");
  doc.text(`: ${project.title}`, 55, y);
  doc.text(`: ${bastType}`, 55, y + 6);
  doc.text(`: ${formattedValue}`, 55, y + 12);

  y += 24;
  const closingText = `Demikian Berita Acara serah terima pekerjaan ${bastType} ini kami buat dan kami tandatangani.`;
  const closingLines = doc.splitTextToSize(closingText, 170);
  doc.text(closingLines, 20, y);

  // Signatures
  y += closingLines.length * 6 + 10;
  doc.text(`Jakarta, ${formattedDate}`, 20, y);

  y += 10;
  doc.text("Dibuat oleh", 20, y);
  doc.text("Mengetahui", 140, y);

  y += 25;
  doc.setFont("helvetica", "bold");
  doc.text(user.name, 20, y);
  doc.text("(.....)", 140, y);

  // Save PDF
  doc.save(`BAST_${project.title.replace(/\s+/g, "_")}.pdf`);
}
