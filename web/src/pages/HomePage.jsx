import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from '../api/axiosClient';
import { 
  Phone, Calendar, Clock, MapPin, Search, Menu, X, 
  ChevronRight, ArrowRight, Star, ShieldCheck, Activity, 
  Heart, User, Stethoscope, Mail, Facebook, Youtube, Instagram 
} from 'lucide-react';

const HOMEPAGE_IMAGES = {
  hero: '/images/hero.jpg',
  about: '/images/about.jpg',
  doctors: [
    '/images/doctor-1.jpg',
    '/images/doctor-2.jpg',
    '/images/doctor-3.jpg',
    '/images/doctor-4.jpg',
  ],
  news: [
    '/images/news-1.jpg',
    '/images/news-2.jpg',
    '/images/news-3.jpg',
  ],
  fallback: '/images/hero.jpg',
};

const handleImageError = (e) => {
  if (e.target.dataset.fallbackApplied) return;
  e.target.dataset.fallbackApplied = 'true';
  e.target.src = HOMEPAGE_IMAGES.fallback;
};

// --- Components Con (Local) ---

const SectionTitle = ({ title, subtitle, align = "center" }) => (
  <div className={`mb-12 ${align === "center" ? "text-center" : "text-left"}`}>
    <span className="text-primary-600 font-bold tracking-wider uppercase text-sm mb-2 block">
      {subtitle}
    </span>
    <h2 className="text-3xl md:text-4xl font-bold text-slate-900">
      {title}
    </h2>
    <div className={`h-1 w-20 bg-primary-500 mt-4 ${align === "center" ? "mx-auto" : ""}`}></div>
  </div>
);

const ServiceCard = ({ icon: Icon, title, desc }) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group cursor-pointer">
    <div className="w-14 h-14 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center mb-4 group-hover:bg-primary-600 group-hover:text-white transition-colors">
      <Icon size={30} />
    </div>
    <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-primary-600 transition-colors">{title}</h3>
    <p className="text-gray-500 text-sm leading-relaxed mb-4">{desc}</p>
    <div className="flex items-center text-primary-600 font-semibold text-sm group-hover:gap-1 transition-all">
      Xem chi tiết <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
    </div>
  </div>
);

const DoctorCard = ({ img, name, specialty }) => (
  <div className="bg-white rounded-2xl overflow-hidden shadow-card hover:shadow-card-hover transition-all group">
    <div className="relative overflow-hidden h-64 bg-gray-100">
      <img src={img} alt={name} className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500" onError={handleImageError} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-4">
        <Link to="/login" className="bg-white text-primary-700 px-4 py-2 rounded-full font-semibold text-sm hover:bg-primary-50 transition-colors">
          Đặt lịch ngay
        </Link>
      </div>
    </div>
    <div className="p-4 text-center">
      <h3 className="text-lg font-bold text-slate-900">{name}</h3>
      <p className="text-primary-600 text-sm font-medium mb-2">{specialty}</p>
      <div className="flex justify-center gap-1 text-yellow-400 text-xs">
        {[1,2,3,4,5].map(i => <Star key={i} size={12} fill="currentColor" />)}
      </div>
    </div>
  </div>
);

const NewsCard = ({ img, title, date, desc, newsId }) => (
  <Link to={newsId ? `/patient/tintuc?maTin=${encodeURIComponent(newsId)}` : '/patient/tintuc'} className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-all group cursor-pointer block">
    <div className="h-48 overflow-hidden">
      <img src={img} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={handleImageError} />
    </div>
    <div className="p-5">
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
        <Calendar size={14} /> {date}
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-2 line-clamp-2 group-hover:text-primary-600 transition-colors">
        {title}
      </h3>
      <p className="text-gray-500 text-sm line-clamp-2 mb-4">
        {desc}
      </p>
      <span className="text-primary-600 font-medium text-sm group-hover:underline inline-flex items-center gap-1">
        Đọc tiếp <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
      </span>
    </div>
  </Link>
);

// --- Main Page Component ---

const HomePage = () => {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [news, setNews] = useState([]);
  const [homeLoading, setHomeLoading] = useState(true);
  const [homeError, setHomeError] = useState('');

  useEffect(() => {
    let mounted = true;

    const extractArray = (response) => {
      const value = response?.data?.data ?? response?.data;
      return Array.isArray(value) ? value : [];
    };

    const loadHomeData = async () => {
      setHomeLoading(true);
      setHomeError('');

      try {
        const [departmentResponse, doctorResponse, newsResponse] =
          await Promise.all([
            axios.get('/public/khoa'),
            axios.get('/public/bacsi', { params: { limit: 8 } }),
            axios.get('/public/tintuc', { params: { limit: 6 } }),
          ]);

        if (!mounted) return;
        setDepartments(extractArray(departmentResponse));
        setDoctors(extractArray(doctorResponse));
        setNews(extractArray(newsResponse));
      } catch (error) {
        console.error('Không thể tải dữ liệu trang chủ', error);
        if (!mounted) return;
        setDepartments([]);
        setDoctors([]);
        setNews([]);
        setHomeError(
          error?.response?.data?.error?.message ||
            'Không thể tải dữ liệu mới nhất từ bệnh viện.',
        );
      } finally {
        if (mounted) setHomeLoading(false);
      }
    };

    loadHomeData();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    
    // Smooth scroll for anchor links
    const handleAnchorClick = (e) => {
      const target = e.target.closest('a');
      if (target && target.getAttribute('href')?.startsWith('#')) {
        const href = target.getAttribute('href');
        if (href && href !== '#') {
          e.preventDefault();
          const element = document.querySelector(href);
          if (element) {
            const headerOffset = 80;
            const elementPosition = element.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
            window.scrollTo({
              top: offsetPosition,
              behavior: 'smooth'
            });
            setMobileMenuOpen(false);
          }
        }
      }
    };
    
    document.addEventListener('click', handleAnchorClick);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('click', handleAnchorClick);
    };
  }, []);

  return (
    <div className="font-sans text-slate-800 bg-white">
      
      {/* 1. Top Bar (Contact Info) */}
      <div className="bg-primary-900 text-blue-100 py-2 px-4 text-xs md:text-sm hidden md:block">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex gap-6">
            <span className="flex items-center gap-2"><Phone size={14} /> Hotline: 1900 1234 (24/7)</span>
            <span className="flex items-center gap-2"><Mail size={14} /> contact@smarthospital.vn</span>
            <span className="flex items-center gap-2"><Clock size={14} /> Giờ làm việc: 7:00 - 17:00 (T2-T7)</span>
          </div>
          <div className="flex gap-4">
            <a href="#" className="hover:text-white transition">Tuyển dụng</a>
            <a href="#" className="hover:text-white transition">Hỏi đáp</a>
            <div className="flex gap-3 border-l border-blue-800 pl-4">
               <Facebook size={14} className="cursor-pointer hover:text-white"/>
               <Youtube size={14} className="cursor-pointer hover:text-white"/>
               <Instagram size={14} className="cursor-pointer hover:text-white"/>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Navbar */}
      <header className={`sticky top-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-white shadow-md py-2' : 'bg-white/95 backdrop-blur-sm py-4'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-500 rounded-lg flex items-center justify-center text-white font-bold text-2xl shadow-lg group-hover:scale-110 transition-transform">
              +
            </div>
            <div className="leading-tight">
              <h1 className="text-xl font-bold text-primary-900 tracking-tight">SmartHospital</h1>
              <p className="text-[10px] text-gray-500 font-medium tracking-wider uppercase">Chăm sóc từ trái tim</p>
            </div>
          </Link>

          {/* Desktop Menu */}
          <nav className="hidden lg:flex items-center gap-8 font-medium text-gray-600">
            <Link to="/" className="text-primary-600">Trang chủ</Link>
            <a href="#about" className="hover:text-primary-600 transition">Giới thiệu</a>
            <a href="#services" className="hover:text-primary-600 transition">Chuyên khoa</a>
            <a href="#doctors" className="hover:text-primary-600 transition">Bác sĩ</a>
            <a href="#news" className="hover:text-primary-600 transition">Tin tức</a>
            <a href="#contact" className="hover:text-primary-600 transition">Liên hệ</a>
          </nav>

          {/* Action Buttons */}
          <div className="hidden lg:flex items-center gap-3">
            <a
              href="tel:19001234"
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-full font-semibold shadow-md hover:bg-red-700 transition-all"
            >
              <Phone size={16} />
              Cấp cứu
            </a>
            <Link to="/login" className="px-4 py-2 text-primary-700 font-semibold hover:bg-primary-50 rounded-lg transition">
              Đăng nhập
            </Link>
            <Link to="/login" className="px-5 py-2 bg-primary-600 text-white rounded-full font-bold shadow-md hover:bg-primary-700 hover:shadow-lg transition-all flex items-center gap-2">
              <Calendar size={18} />
              Đặt lịch khám
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button className="lg:hidden text-gray-600" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-t p-4 shadow-lg absolute w-full left-0 top-full animate-fade-in">
            <nav className="flex flex-col gap-4 font-medium text-lg">
              <Link to="/" onClick={() => setMobileMenuOpen(false)}>Trang chủ</Link>
              <a href="#services" onClick={() => setMobileMenuOpen(false)}>Dịch vụ</a>
              <a href="#doctors" onClick={() => setMobileMenuOpen(false)}>Bác sĩ</a>
              <a href="#news" onClick={() => setMobileMenuOpen(false)}>Tin tức</a>
              <Link to="/login" className="text-primary-600" onClick={() => setMobileMenuOpen(false)}>Đăng nhập</Link>
              <a
                href="tel:19001234"
                className="flex items-center justify-center gap-2 bg-red-600 text-white py-2.5 rounded-lg font-semibold"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Phone size={18} /> Gọi cấp cứu 1900 1234
              </a>
              <Link to="/login" className="bg-primary-600 text-white text-center py-2 rounded-lg" onClick={() => setMobileMenuOpen(false)}>
                Đặt lịch ngay
              </Link>
            </nav>
          </div>
        )}
      </header>

      {/* 3. Hero Section */}
      <section className="relative pt-10 pb-20 lg:pt-20 lg:pb-32 overflow-hidden bg-gradient-to-br from-blue-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col lg:flex-row items-center gap-12">
          {/* Text Content */}
          <div className="lg:w-1/2 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-primary-700 text-sm font-semibold">
              <ShieldCheck size={16} /> Bệnh viện đạt chuẩn quốc tế JCI
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 leading-tight">
              Chăm Sóc Sức Khỏe <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-teal-500">
                Toàn Diện & Tận Tâm
              </span>
            </h1>
            <p className="text-lg text-gray-600 max-w-xl mx-auto lg:mx-0">
              Hệ thống y tế SmartHospital cung cấp dịch vụ khám chữa bệnh chất lượng cao với đội ngũ chuyên gia hàng đầu và trang thiết bị hiện đại.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-4">
              <Link to="/login" className="btn btn-primary px-8 py-3 text-lg rounded-full shadow-xl shadow-primary-200">
                Đặt lịch khám ngay
              </Link>
              <Link to="/login" className="btn bg-white text-slate-700 border border-gray-200 hover:bg-gray-50 px-8 py-3 text-lg rounded-full flex items-center justify-center gap-2">
                <Activity size={20} /> Gói khám sức khỏe
              </Link>
            </div>

            <a
              href="tel:19001234"
              className="inline-flex items-center gap-3 mt-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 transition-colors w-fit mx-auto lg:mx-0"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white shrink-0">
                <Phone size={18} />
              </span>
              <span className="text-left">
                <span className="block text-xs font-medium text-red-500 uppercase tracking-wide">Hotline cấp cứu 24/7</span>
                <span className="block text-lg font-bold text-red-800">1900 1234</span>
              </span>
            </a>
            
            {/* Quick Stats */}
            <div className="pt-8 flex justify-center lg:justify-start gap-8 border-t border-gray-200 mt-8">
              <div>
                <p className="text-3xl font-bold text-primary-700">15+</p>
                <p className="text-sm text-gray-500">Năm kinh nghiệm</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-primary-700">50+</p>
                <p className="text-sm text-gray-500">Bác sĩ chuyên khoa</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-primary-700">10k+</p>
                <p className="text-sm text-gray-500">Bệnh nhân / năm</p>
              </div>
            </div>
          </div>

          {/* Hero Image */}
          <div className="lg:w-1/2 relative w-full">
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-blue-200/30 rounded-full blur-3xl -z-10 pointer-events-none"></div>
             <img 
               src={HOMEPAGE_IMAGES.hero}
               alt="Hospital Team" 
               className="rounded-3xl shadow-2xl border-4 border-white object-cover w-full h-[320px] sm:h-[420px] lg:h-[500px]"
               onError={handleImageError}
             />
          </div>
        </div>
      </section>

      {/* 4. About Section */}
      <section id="about" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <SectionTitle 
                title="Về SmartHospital" 
                subtitle="Giới thiệu" 
                align="left"
              />
              <p className="text-gray-600 mb-6 leading-relaxed">
                SmartHospital là hệ thống bệnh viện thông minh hàng đầu, được thành lập với sứ mệnh mang đến dịch vụ y tế chất lượng cao, hiện đại và tiện lợi cho mọi người dân.
              </p>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Với đội ngũ bác sĩ giàu kinh nghiệm, trang thiết bị y tế hiện đại và quy trình làm việc chuyên nghiệp, chúng tôi cam kết cung cấp dịch vụ chăm sóc sức khỏe toàn diện, từ khám sức khỏe định kỳ đến điều trị các bệnh lý phức tạp.
              </p>
              <div className="grid grid-cols-2 gap-6 mt-8">
                <div className="bg-white p-4 rounded-xl shadow-sm">
                  <div className="text-3xl font-bold text-primary-600 mb-2">15+</div>
                  <div className="text-sm text-gray-600">Năm kinh nghiệm</div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm">
                  <div className="text-3xl font-bold text-primary-600 mb-2">50+</div>
                  <div className="text-sm text-gray-600">Bác sĩ chuyên khoa</div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm">
                  <div className="text-3xl font-bold text-primary-600 mb-2">10k+</div>
                  <div className="text-sm text-gray-600">Bệnh nhân/năm</div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm">
                  <div className="text-3xl font-bold text-primary-600 mb-2">24/7</div>
                  <div className="text-sm text-gray-600">Hỗ trợ cấp cứu</div>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary-100 to-secondary-100 rounded-3xl transform rotate-3"></div>
              <img 
                src={HOMEPAGE_IMAGES.about}
                alt="About SmartHospital" 
                className="relative rounded-3xl shadow-2xl w-full h-[500px] object-cover"
                onError={handleImageError}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 5. Services Section */}
      <section id="services" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionTitle
            title="Chuyên Khoa Nổi Bật"
            subtitle="Dữ liệu cập nhật từ bệnh viện"
          />

          {homeError && (
            <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800">
              {homeError}
            </div>
          )}

          {homeLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="h-56 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : departments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {departments.slice(0, 9).map((department, index) => {
                const icons = [Heart, User, Activity, Stethoscope, ShieldCheck, MapPin];
                return (
                  <ServiceCard
                    key={department.maKhoa || index}
                    icon={icons[index % icons.length]}
                    title={department.tenKhoa || 'Chuyên khoa'}
                    desc={department.moTa || 'Dịch vụ khám và điều trị chuyên sâu của bệnh viện.'}
                  />
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-500">
              Chưa có chuyên khoa đang hoạt động.
            </div>
          )}
        </div>
      </section>

      {/* 6. Doctors Section */}
      <section id="doctors" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionTitle
            title="Đội Ngũ Chuyên Gia"
            subtitle="Bác sĩ đang công tác"
          />

          {homeLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="h-80 animate-pulse rounded-2xl bg-slate-200" />
              ))}
            </div>
          ) : doctors.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {doctors.slice(0, 8).map((doctor, index) => (
                <DoctorCard
                  key={doctor.maBS || index}
                  img={
                    doctor.hinhAnh ||
                    HOMEPAGE_IMAGES.doctors[index % HOMEPAGE_IMAGES.doctors.length]
                  }
                  name={doctor.hoTen || 'Bác sĩ'}
                  specialty={
                    doctor.chuyenMon ||
                    doctor.Khoa?.tenKhoa ||
                    'Bác sĩ chuyên khoa'
                  }
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
              Chưa có bác sĩ đang hoạt động để hiển thị.
            </div>
          )}
        </div>
      </section>

      {/* 7. Feature Banner */}
      <section className="py-16 bg-primary-600 text-white relative overflow-hidden">
         <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/medical-icons.png')] opacity-10"></div>
         <div className="max-w-7xl mx-auto px-4 relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div>
              <h2 className="text-3xl font-bold mb-4">Bạn cần tư vấn sức khỏe?</h2>
              <p className="text-blue-100 max-w-xl text-lg">
                Đừng ngần ngại liên hệ với chúng tôi. Đội ngũ bác sĩ sẵn sàng hỗ trợ bạn 24/7 qua hệ thống Chatbot và Tổng đài.
              </p>
            </div>
            <div className="flex gap-4">
               <a href="tel:19001234" className="bg-white text-primary-700 px-6 py-3 rounded-full font-bold hover:bg-blue-50 transition shadow-lg">
                 Gọi 1900 1234
               </a>
               <Link to="/login" className="bg-transparent border-2 border-white px-6 py-3 rounded-full font-bold hover:bg-white/10 transition">
                 Chat với Bác sĩ
               </Link>
            </div>
         </div>
      </section>

      {/* 8. News Section */}
      <section id="news" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-end mb-12">
            <div className="text-left">
              <span className="text-primary-600 font-bold tracking-wider uppercase text-sm mb-2 block">Cẩm nang y tế</span>
              <h2 className="text-3xl font-bold text-slate-900">Tin Tức Mới Nhất</h2>
            </div>
            <Link to="/patient/tintuc" className="hidden md:flex items-center gap-1 text-primary-600 font-semibold hover:gap-2 transition-all">
              Xem tất cả <ArrowRight size={18}/>
            </Link>
          </div>

          {homeLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="h-96 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : news.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {news.slice(0, 6).map((item, index) => (
                <NewsCard
                  key={item.maTin || index}
                  newsId={item.maTin}
                  img={
                    item.hinhAnh ||
                    HOMEPAGE_IMAGES.news[index % HOMEPAGE_IMAGES.news.length]
                  }
                  title={item.tieuDe || 'Tin tức bệnh viện'}
                  date={
                    item.ngayDang
                      ? new Date(item.ngayDang).toLocaleDateString('vi-VN')
                      : ''
                  }
                  desc={item.tomTat || item.noiDung || 'Thông tin mới nhất từ bệnh viện.'}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-500">
              Chưa có tin tức đang được xuất bản.
            </div>
          )}
        </div>
      </section>

      {/* 9. Footer */}
      <footer className="bg-slate-900 text-slate-300 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
           
           {/* Col 1: Brand */}
           <div>
             <div className="flex items-center gap-2 mb-6">
                <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
                  +
                </div>
                <span className="text-2xl font-bold text-white">SmartHospital</span>
             </div>
             <p className="mb-6 leading-relaxed text-sm">
               Hệ thống quản lý bệnh viện thông minh, mang đến trải nghiệm khám chữa bệnh hiện đại, tiện lợi và an toàn cho mọi người.
             </p>
             <div className="flex gap-4">
                <a href="#" className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center hover:bg-primary-600 transition text-white"><Facebook size={16}/></a>
                <a href="#" className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center hover:bg-red-600 transition text-white"><Youtube size={16}/></a>
                <a href="#" className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center hover:bg-pink-600 transition text-white"><Instagram size={16}/></a>
             </div>
           </div>

           {/* Col 2: Quick Links */}
           <div>
             <h3 className="text-white font-bold text-lg mb-6">Liên Kết Nhanh</h3>
             <ul className="space-y-3 text-sm">
               <li><Link to="/" className="hover:text-primary-500 transition">Trang chủ</Link></li>
               <li><a href="#about" className="hover:text-primary-500 transition">Giới thiệu</a></li>
               <li><a href="#doctors" className="hover:text-primary-500 transition">Đội ngũ bác sĩ</a></li>
               <li><Link to="/login" className="hover:text-primary-500 transition">Đặt lịch khám</Link></li>
               <li><Link to="/login" className="hover:text-primary-500 transition">Tra cứu kết quả</Link></li>
             </ul>
           </div>

           {/* Col 3: Services */}
           <div>
             <h3 className="text-white font-bold text-lg mb-6">Dịch Vụ</h3>
             <ul className="space-y-3 text-sm">
               <li><a href="#" className="hover:text-primary-500 transition">Khám tổng quát</a></li>
               <li><a href="#" className="hover:text-primary-500 transition">Tầm soát ung thư</a></li>
               <li><a href="#" className="hover:text-primary-500 transition">Thai sản trọn gói</a></li>
               <li><a href="#" className="hover:text-primary-500 transition">Xét nghiệm tại nhà</a></li>
               <li><a href="#" className="hover:text-primary-500 transition">Bảo hiểm y tế</a></li>
             </ul>
           </div>

           {/* Col 4: Contact */}
           <div id="contact">
             <h3 className="text-white font-bold text-lg mb-6">Liên Hệ</h3>
             <ul className="space-y-4 text-sm">
               <li className="flex gap-3">
                 <MapPin className="text-primary-500 flex-shrink-0" size={20} />
                 <span>123 Đường Nguyễn Văn Cừ, Quận 5, TP. Hồ Chí Minh</span>
               </li>
               <li className="flex gap-3">
                 <Phone className="text-primary-500 flex-shrink-0" size={20} />
                 <span>1900 1234 - 028 3838 3838</span>
               </li>
               <li className="flex gap-3">
                 <Mail className="text-primary-500 flex-shrink-0" size={20} />
                 <span>info@smarthospital.vn</span>
               </li>
             </ul>
           </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 mt-16 pt-8 border-t border-slate-800 text-center text-sm text-slate-500">
          <p>© 2025 SmartHospital. All rights reserved. Designed with ❤️.</p>
        </div>
      </footer>

      {/* Nút gọi cấp cứu cố định — góc dưới trái, không che nội dung chính */}
      <a
        href="tel:19001234"
        aria-label="Gọi cấp cứu 1900 1234"
        className="fixed bottom-6 left-4 sm:left-6 z-40 flex items-center gap-2 sm:gap-3 bg-red-600 hover:bg-red-700 text-white pl-3 pr-4 sm:pl-4 sm:pr-5 py-3 rounded-full shadow-lg shadow-red-300/50 hover:shadow-xl hover:shadow-red-400/40 transition-all hover:-translate-y-0.5 max-w-[calc(100vw-2rem)]"
      >
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
          <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-40" />
          <Phone size={20} className="relative z-10" />
        </span>
        <span className="text-left leading-tight min-w-0">
          <span className="block text-[10px] sm:text-xs font-medium uppercase tracking-wide opacity-90">Gọi cấp cứu</span>
          <span className="block text-sm sm:text-base font-bold truncate">1900 1234</span>
        </span>
      </a>

    </div>
  );
};

export default HomePage;