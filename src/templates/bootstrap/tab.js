export default {
  form: `
<div class="card">
  <div class="card-header">
    <ul class="nav nav-tabs card-header-tabs">
      {% component.components.forEach(function(tab, index) { %}
      <li class="nav-item{{ currentTab === index ? ' active' : ''}}" role="presentation" ref="{{tabLikey}}">
        <a class="nav-link{{ currentTab === index ? ' active' : ''}}" href="#{{tab.key}}" ref="{{tabLinkKey}}">{{t(tab.label)}}</a>
      </li>
      {% }) %}
    </ul>
  </div>
  {% component.components.forEach(function(tab, index) { %}
  <div 
    role="tabpanel" 
    class="card-body tab-pane{{ currentTab === index ? ' active' : ''}}"
    style="display: {{currentTab === index ? 'block' : 'none'}}" 
    ref="{{tabKey}}""
  >
    {{tabComponents[index]}}
  </div>
  {% }) %}
</div>
`,
};
