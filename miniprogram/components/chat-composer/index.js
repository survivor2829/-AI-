Component({
  properties: {
    value: {
      type: String,
      value: '',
    },
    placeholder: {
      type: String,
      value: '请输入您的问题或需求…',
    },
    large: {
      type: Boolean,
      value: false,
    },
    disabled: {
      type: Boolean,
      value: false,
    },
    voiceState: {
      type: String,
      value: 'idle',
    },
  },

  methods: {
    onInput(event) {
      this.triggerEvent('change', { value: event.detail.value });
    },

    onFocus() {
      this.triggerEvent('focus');
    },

    onConfirm(event) {
      this.triggerEvent('submit', { value: event.detail.value });
    },

    onSubmit() {
      this.triggerEvent('submit', { value: this.properties.value });
    },

    onSendTap() {
      if (!this.properties.disabled && this.properties.value) {
        this.triggerEvent('submit', { value: this.properties.value });
      }
    },

    onVoiceTap() {
      if (!this.properties.disabled) {
        this.triggerEvent('voice');
      }
    },
  },
});
