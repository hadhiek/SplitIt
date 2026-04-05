from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "SplitIt API"
    
    # Supabase config
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    SUPABASE_JWT_SECRET: str = ""
    
    # Database URL
    DATABASE_URL: str = ""

    model_config = SettingsConfigDict(env_file=".env")

settings = Settings()
