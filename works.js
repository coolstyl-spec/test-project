// ข้อมูลผลงานทั้งหมด — แก้ไข/เพิ่มผลงานได้ที่ไฟล์นี้ไฟล์เดียว
// รูปภาพ: วางไฟล์ไว้ในโฟลเดอร์ images/ แล้วใส่ชื่อไฟล์ เช่น "images/my-work.jpg"
// ถ้าไม่ใส่ image ระบบจะสร้างภาพปกสีให้อัตโนมัติ

const PROFILE = {
  name: "ชื่อของคุณ",
  role: "นักออกแบบ / นักพัฒนา",
  bio: "รวมผลงานที่ผ่านมา ทั้งงานออกแบบ เว็บไซต์ และโปรเจกต์ส่วนตัว",
  email: "you@example.com",
  links: [
    { label: "GitHub", url: "https://github.com/" },
    { label: "Facebook", url: "https://facebook.com/" },
  ],
};

const WORKS = [
  {
    title: "เว็บไซต์ร้านกาแฟ",
    category: "เว็บไซต์",
    year: 2026,
    description: "ออกแบบและพัฒนาเว็บไซต์สำหรับร้านกาแฟท้องถิ่น พร้อมเมนูและแผนที่ร้าน",
    tags: ["HTML", "CSS", "JavaScript"],
    image: "",
    link: "",
  },
  {
    title: "โลโก้แบรนด์เสื้อผ้า",
    category: "ออกแบบกราฟิก",
    year: 2025,
    description: "ออกแบบโลโก้และอัตลักษณ์แบรนด์ ทั้งสี ฟอนต์ และการใช้งานบนสินค้า",
    tags: ["Illustrator", "Branding"],
    image: "",
    link: "",
  },
  {
    title: "แอปจดรายรับรายจ่าย",
    category: "แอปพลิเคชัน",
    year: 2025,
    description: "แอปบันทึกรายรับรายจ่ายรายวัน พร้อมกราฟสรุปรายเดือน",
    tags: ["React", "Chart"],
    image: "",
    link: "",
  },
  {
    title: "ภาพถ่ายชุดทะเลภาคใต้",
    category: "ภาพถ่าย",
    year: 2024,
    description: "ภาพถ่ายทิวทัศน์ทะเลและวิถีชีวิตชาวประมงในภาคใต้",
    tags: ["Photography", "Landscape"],
    image: "",
    link: "",
  },
  {
    title: "โปสเตอร์งานดนตรี",
    category: "ออกแบบกราฟิก",
    year: 2024,
    description: "โปสเตอร์ประชาสัมพันธ์งานคอนเสิร์ตนักศึกษา",
    tags: ["Photoshop", "Poster"],
    image: "",
    link: "",
  },
  {
    title: "ระบบจองห้องประชุม",
    category: "เว็บไซต์",
    year: 2023,
    description: "ระบบจองห้องประชุมภายในองค์กร มีปฏิทินและการแจ้งเตือนทางอีเมล",
    tags: ["PHP", "MySQL"],
    image: "",
    link: "",
  },
];
