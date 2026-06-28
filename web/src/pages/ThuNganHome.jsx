import React from "react";
import { Link } from "react-router-dom";
import { Banknote, Receipt, TrendingUp } from "lucide-react";

const ThuNganHome = () => (
  <div className="space-y-6">
    <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-6 text-white shadow-lg">
      <h1 className="text-2xl font-bold mb-2">Xin chào, Thu ngân!</h1>
      <p className="text-emerald-100 text-sm">
        Quản lý thu viện phí, xuất hóa đơn điện tử và in biên lai cho bệnh nhân.
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Link
        to="/thungan/thanhtoan"
        className="card card-hover flex items-start gap-4 group"
      >
        <div className="p-3 rounded-xl bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
          <Banknote size={24} />
        </div>
        <div>
          <h2 className="font-semibold text-gray-800">Thu viện phí</h2>
          <p className="text-sm text-gray-500 mt-1">
            Danh sách hóa đơn chờ thanh toán, chi tiết dịch vụ và in E-Invoice
          </p>
        </div>
      </Link>

      <div className="card opacity-60 cursor-not-allowed flex items-start gap-4">
        <div className="p-3 rounded-xl bg-gray-100 text-gray-500">
          <TrendingUp size={24} />
        </div>
        <div>
          <h2 className="font-semibold text-gray-600">Báo cáo doanh thu</h2>
          <p className="text-sm text-gray-400 mt-1">Sắp ra mắt (mock UI only)</p>
        </div>
      </div>

      <div className="card opacity-60 cursor-not-allowed flex items-start gap-4">
        <div className="p-3 rounded-xl bg-gray-100 text-gray-500">
          <Receipt size={24} />
        </div>
        <div>
          <h2 className="font-semibold text-gray-600">Tra cứu hóa đơn</h2>
          <p className="text-sm text-gray-400 mt-1">Sắp ra mắt (mock UI only)</p>
        </div>
      </div>
    </div>
  </div>
);

export default ThuNganHome;
