CREATE TABLE tb_Patch_Task (
  id varchar(36) NOT NULL,
  name varchar(128) default NULL,
  version_type varchar(100) default NULL COMMENT '版本类型',
  version_value varchar(100) default NULL COMMENT '版本信息',
  version_timestamp datetime default NULL COMMENT '版本时间戳',
  update_date datetime default NULL,
  create_date datetime default NULL,
  PRIMARY KEY  (id)
)