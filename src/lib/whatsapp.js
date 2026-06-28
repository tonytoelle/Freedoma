export function getWhatsAppReminderLink(project, userDetails) {
  const name = userDetails?.name || "Anthonius Ari Toelle";
  const formattedValue = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(project.value);

  const text = `Halo ${project.contactName || "Kak"}, saya ${name}. Ingin mengingatkan untuk project "${project.title}" (${project.projectType || "Color Grading"}) senilai ${formattedValue} yang invoicenya belum terbayarkan. Berikut link invoice dan dokumen pelengkapnya. Terima kasih!`;
  
  const cleanPhone = (project.contactPhone || "").replace(/[^0-9]/g, "");
  // Convert 08... to 62...
  const formattedPhone = cleanPhone.startsWith("0") ? "62" + cleanPhone.slice(1) : cleanPhone;
  
  return {
    link: `https://wa.me/${formattedPhone}?text=${encodeURIComponent(text)}`,
    text
  };
}
