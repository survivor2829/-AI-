App({
  onLaunch() {
    if (wx.cloud) {
      try {
        wx.cloud.init({
          traceUser: true,
        });
      } catch (error) {
        // 游客 AppID 或未开通云环境时，页面会自动使用确定性 Demo 回退。
      }
    }
  },
});
