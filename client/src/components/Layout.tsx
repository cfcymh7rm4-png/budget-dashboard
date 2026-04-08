import { Outlet, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Settings, User, LogOut } from "lucide-react";
import { useCurrentUserProfile } from "@lark-apaas/client-toolkit/hooks/useCurrentUserProfile";
import { getDataloom } from "@lark-apaas/client-toolkit/dataloom";
import { logger } from "@lark-apaas/client-toolkit/logger";
import { useAppInfo } from "@lark-apaas/client-toolkit/hooks/useAppInfo";
import { Button } from "@/components/lightweight-ui";
import './layout.css';

const navItems = [
  { path: "/", label: "预算概览", icon: LayoutDashboard },
  { path: "/config", label: "预算配置", icon: Settings },
];

const Layout = () => {
  const { pathname } = useLocation();
  const userInfo = useCurrentUserProfile();
  const { appName } = useAppInfo();

  const handleLogout = async () => {
    try {
      const dataloom = await getDataloom();
      const result = await dataloom.service.session.signOut();
      if (result.error) {
        logger.error("退出登录失败:", result.error.message);
        return;
      }
      window.location.reload();
    } catch (error) {
      logger.error("退出登录异常:", String(error));
    }
  };

  const handleLogin = async () => {
    try {
      const dataloom = await getDataloom();
      dataloom.service.session.redirectToLogin();
    } catch (error) {
      logger.error("跳转登录异常:", String(error));
    }
  };

  const isLoggedIn = !!userInfo?.user_id;

  return (
    <div className="layout-container">
      {/* 侧边栏 */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <Link to="/" className="sidebar-brand">
            <div className="brand-icon">
              <LayoutDashboard className="icon" />
            </div>
            <span className="brand-text">{appName || "预算消耗看板"}</span>
          </Link>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${pathname === item.path ? 'active' : ''}`}
            >
              <item.icon className="nav-icon" />
              <span className="nav-text">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-section">
            <div className="user-avatar">
              {userInfo?.avatar ? (
                <img src={userInfo.avatar} alt={userInfo.name} />
              ) : (
                <User className="icon" />
              )}
            </div>
            <div className="user-info">
              <span className="user-name">{userInfo?.name || "游客"}</span>
              <span className="user-status">{isLoggedIn ? "已登录" : "未登录"}</span>
            </div>
          </div>
          {isLoggedIn ? (
            <Button variant="outline" size="sm" onClick={handleLogout} className="w-full">
              <LogOut className="btn-icon" />
              退出
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={handleLogin} className="w-full">
              <User className="btn-icon" />
              登录
            </Button>
          )}
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
